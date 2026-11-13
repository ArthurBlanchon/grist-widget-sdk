import { Component, type ComponentType, type ReactNode } from "react"
import { waitFor } from "@testing-library/react"

import { entryProps, GristWidgetApp, isGristWidgetEntry, type GristWidgetEntry } from "../../app/mount-grist-widget"
import type { GristReplicaDocument, GristWidget, UseGristOptions } from "../../sdk"
import { declaredColumns, declaredDocument, mapEveryColumn } from "./declared-document"
import { installJsdomStubs } from "./jsdom-stubs"
import { renderWithGrist } from "./render-with-grist"

export type SmokeTestWidgetOptions = {
  /** The widget, as `src/main.tsx` passes it to `mountGristWidget()`. */
  App: ComponentType
  /** The widget's `GRIST_OPTIONS` (or pass `widget`). */
  options?: UseGristOptions
  /** The widget's declaration, from `defineGristWidget()` (or pass `options`). */
  widget?: GristWidget
  /**
   * The Grist document to run against. Defaults to one table with a column
   * per column the widget declares, typed after the first type it accepts,
   * and one row of sample values.
   */
  document?: GristReplicaDocument
  /** How long to wait for the widget to render, in ms. Defaults to 10 000. */
  timeout?: number
}

/**
 * Mounts the widget the way `mountGristWidget()` does inside Grist, against
 * an emulated Grist document with every column it declares mapped and the
 * access it requests granted, and waits until it renders past
 * `GristBoundary`. Resolves once it has,
 * rejects with the widget's own error if it throws, or with what the page
 * showed instead if it never gets there. Then unmounts.
 *
 * A widget's whole smoke test, given its entry module as `mountGristWidget()`
 * takes it (the widget, and its `widget` declaration or `GRIST_OPTIONS`):
 *
 * ```tsx
 * import { it } from "vitest"
 * import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"
 * import * as entry from "./App"
 *
 * it("renders inside Grist", () => smokeTestWidget(entry))
 * ```
 *
 * It only reads the declaration, so it stays valid as the widget changes,
 * and it improves with each SDK release. `smokeTestWidget({ App, options })`
 * and `smokeTestWidget({ App, widget })` work too.
 */
export async function smokeTestWidget(
  input: SmokeTestWidgetOptions | GristWidgetEntry,
  extra: Pick<SmokeTestWidgetOptions, "document" | "timeout"> = {}
): Promise<void> {
  const { App, options: given, widget, document, timeout = 10_000 } =
    isGristWidgetEntry(input) ? { ...entryProps(input), ...extra } : input
  installJsdomStubs()
  const options = given ?? widget?.options
  if (!options) throw new Error("smokeTestWidget: pass the widget's `widget` (defineGristWidget) or its `options` (GRIST_OPTIONS).")

  const crash: { error: unknown } = { error: undefined }
  function Probe() {
    return (
      <CatchRenderError crash={crash}>
        <div data-grist-smoke-test="">
          <App />
        </div>
      </CatchRenderError>
    )
  }

  const columns = declaredColumns(options)
  const gristDocument = document ?? declaredDocument(columns)
  const result = renderWithGrist(<GristWidgetApp App={Probe} options={options} />, {
    emulator: {
      document: gristDocument,
      // Granted as the user would in Grist's widget panel: the access the
      // widget asks for, unless the given document says otherwise.
      widgetInteraction: gristDocument.widgetInteraction ?? { access_level: options.requiredAccess ?? "read table" },
    },
  })
  try {
    if (columns.length > 0) result.emulator.setColumnMappings(mapEveryColumn(columns))

    try {
      await waitFor(
        () => {
          if (crash.error !== undefined) return
          const probe = result.container.querySelector("[data-grist-smoke-test]")
          if (!probe || !probe.hasChildNodes()) throw new Error("not rendered yet")
        },
        { timeout }
      )
    } catch {
      const shown = result.container.textContent?.trim().replace(/\s+/g, " ") || "nothing"
      throw new Error(
        `smokeTestWidget: the widget didn't render past GristBoundary within ${timeout} ms. ` +
          `The page showed: "${shown.slice(0, 300)}".`
      )
    }
    if (crash.error !== undefined) throw crash.error
  } finally {
    result.unmount()
  }
}

/** Records the widget's render error, so the test fails with it rather than a timeout. */
class CatchRenderError extends Component<{ crash: { error: unknown }; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    this.props.crash.error = error
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
