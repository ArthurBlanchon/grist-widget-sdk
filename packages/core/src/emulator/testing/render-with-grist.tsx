/**
 * `renderWithGrist(ui, options)` — drop-in replacement for
 * `@testing-library/react`'s `render(ui)` that boots a Grist emulator
 * (inline transport) and exposes it to the test.
 *
 * The emulator is mounted as `window.grist`. The SDK hooks (`useGrist`,
 * `useGristReady`, etc.) detect it via the same path they use in production.
 *
 * Cleanup is automatic when the test's container unmounts.
 */

import { useEffect, type ReactElement, type ReactNode } from "react"

import { render, type RenderOptions, type RenderResult } from "@testing-library/react"

import { GristWidgetApp } from "../../app/mount-grist-widget"
import type { GristWidget, UseGristOptions } from "../../sdk"
import { isGristWidget } from "../../sdk/define-widget"
import { resetGristForTests } from "../../sdk/use-grist"
import { declaredColumns, declaredDocument, mapEveryColumn } from "./declared-document"
import { createGristEmulator } from "../create-grist-emulator"
import type { CreateGristEmulatorOptions, GristEmulator } from "../create-grist-emulator"
import { presets } from "../templates"

export type RenderWithGristOptions = RenderOptions & {
  emulator?: CreateGristEmulatorOptions
  /** Skip mounting the emulator; you bring your own. Useful for shared fixtures. */
  existing?: GristEmulator
  /**
   * The widget's declaration (`defineGristWidget()`) or its `GRIST_OPTIONS`.
   * Given, the test runs the widget as `mountGristWidget()` does inside
   * Grist (provider, boundary, alerts), against a table with a column per
   * declared column, every one mapped, and the access it asks for granted.
   */
  widget?: GristWidget | UseGristOptions
  /**
   * With `widget`: the table's rows, under the declared names, as typed
   * reads give them (`{ Title: "Ship", Due: new Date(...) }`). The first is
   * selected. Defaults to one row of sample values.
   */
  rows?: ReadonlyArray<Record<string, unknown>>
  /** The document open read-only, as for a viewer: `w.readOnly`, and writes fail as in Grist. */
  readOnly?: boolean
}

export type RenderWithGristResult = RenderResult & {
  emulator: GristEmulator
}

export function renderWithGrist(
  ui: ReactElement,
  options: RenderWithGristOptions = {}
): RenderWithGristResult {
  // Make `window.self !== window.top` evaluate to `true` so
  // `useGristAvailability` reports the widget as embedded. We only do this in
  // jsdom; real browsers already enforce this distinction for iframes.
  fakeIframeContext()

  resetGristForTests()
  // Each render says whether the document is read-only: an earlier one's URL
  // doesn't carry over. An existing emulator keeps the URL it made.
  if (options.existing && options.readOnly && !options.existing.state.readOnly) {
    throw new Error("renderWithGrist: readOnly with existing: create it with createGristEmulator({ readOnly: true })")
  }
  if (!options.existing) clearReadOnlyUrl()

  const widgetOptions = options.widget ? (isGristWidget(options.widget) ? options.widget.options : options.widget) : undefined
  const columns = widgetOptions ? declaredColumns(widgetOptions) : []
  const base: CreateGristEmulatorOptions =
    widgetOptions && !options.emulator?.document
      ? {
          ...options.emulator,
          document: declaredDocument(columns, options.rows),
          widgetInteraction: options.emulator?.widgetInteraction ?? { access_level: widgetOptions.requiredAccess ?? "read table" },
        }
      : (options.emulator ?? { document: presets.blank() })
  // A copy: the caller's options object stays as it was.
  const emulatorOptions: CreateGristEmulatorOptions = options.readOnly ? { ...base, readOnly: true } : base
  const emulator = options.existing ?? createGristEmulator(emulatorOptions)
  if (widgetOptions && columns.length > 0) emulator.setColumnMappings(mapEveryColumn(columns))

  const Widget = () => ui
  // Testing Library's own cleanup unmounts the tree without our unmount: the
  // wrapper's effect takes readonly=true back out of the URL then too.
  const Outer = options.wrapper
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReadOnlyUrlScope active={!options.existing && emulator.state.readOnly === true}>
      {Outer ? <Outer>{children}</Outer> : children}
    </ReadOnlyUrlScope>
  )
  // The declaration's languages, so the SDK's chrome speaks the language it would in Grist.
  const languages = options.widget && isGristWidget(options.widget) ? options.widget.metadata.languages : undefined
  const app = widgetOptions ? <GristWidgetApp App={Widget} options={widgetOptions} metadata={languages ? { languages } : undefined} /> : ui
  const result = render(app, { ...options, wrapper })
  const originalUnmount = result.unmount
  result.unmount = () => {
    originalUnmount()
    if (!options.existing) emulator.dispose()
    resetGristForTests()
  }
  return Object.assign(result, { emulator })
}

function ReadOnlyUrlScope({ active, children }: { active: boolean; children: ReactNode }) {
  useEffect(() => (active ? clearReadOnlyUrl : undefined), [active])
  return <>{children}</>
}

function clearReadOnlyUrl() {
  if (typeof window === "undefined" || !window.history?.replaceState) return
  const url = new URL(window.location.href)
  if (!url.searchParams.has("readonly")) return
  url.searchParams.delete("readonly")
  window.history.replaceState(window.history.state, "", url.href)
}

function fakeIframeContext() {
  if (typeof window === "undefined") return
  if (window.self !== window.top) return // already iframe-like
  try {
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => ({}),
    })
  } catch {
    // Some jsdom versions block redefinition; fail silently — tests using
    // `useGristAvailability` will need to bypass it explicitly in that case.
  }
}
