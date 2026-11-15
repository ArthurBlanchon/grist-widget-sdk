/**
 * Widget options that evolve: defineGristWidget({ optionsVersion, migrate }).
 */
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defineGristWidget } from "../../src/sdk"
import { migrateWidgetOptions, OPTIONS_VERSION_KEY, withOptionsVersion } from "../../src/sdk/runtime/options-version"
import { cleanup, renderWithGrist, screen, waitFor } from "../../src/emulator/testing"

afterEach(() => cleanup())

// v1 kept the board's columns as one comma-separated string; v2 as a list.
const migrate = (options: Record<string, unknown>, from: number) =>
  from < 2 && typeof options.columns === "string" ? { ...options, columns: options.columns.split(",") } : options

describe("migrateWidgetOptions", () => {
  it("leaves options alone without a declared version", () => {
    expect(migrateWidgetOptions({ a: 1, __version: 7 }, {})).toEqual({ options: { a: 1, __version: 7 }, save: null })
    expect(migrateWidgetOptions(null, { optionsVersion: 2, migrate })).toEqual({ options: null, save: null })
  })

  it("treats unversioned options as version 1, migrates them, and saves them under the current version", () => {
    expect(migrateWidgetOptions({ columns: "To do,Done" }, { optionsVersion: 2, migrate })).toEqual({
      options: { columns: ["To do", "Done"] },
      save: { columns: ["To do", "Done"], [OPTIONS_VERSION_KEY]: 2 },
    })
  })

  it("hides the version from the widget, and leaves current or newer options as saved", () => {
    expect(migrateWidgetOptions({ columns: ["A"], __version: 2 }, { optionsVersion: 2, migrate })).toEqual({ options: { columns: ["A"] }, save: null })
    expect(migrateWidgetOptions({ columns: ["A"], extra: true, __version: 3 }, { optionsVersion: 2, migrate })).toEqual({
      options: { columns: ["A"], extra: true },
      save: null,
    })
  })

  it("starts an empty section at the current version: nothing to migrate", () => {
    const spy = vi.fn(migrate)
    expect(migrateWidgetOptions({}, { optionsVersion: 3, migrate: spy })).toEqual({ options: {}, save: null })
    expect(spy).not.toHaveBeenCalled()
  })

  it("keeps the saved options when migrate throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const broken = () => {
      throw new Error("no")
    }
    expect(migrateWidgetOptions({ columns: "A" }, { optionsVersion: 2, migrate: broken })).toEqual({ options: { columns: "A" }, save: null })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it("writes the widget's options under the current version", () => {
    expect(withOptionsVersion({ a: 1 }, { optionsVersion: 4 })).toEqual({ a: 1, [OPTIONS_VERSION_KEY]: 4 })
    expect(withOptionsVersion({ a: 1 }, {})).toEqual({ a: 1 })
  })
})

describe("defineGristWidget({ optionsVersion, migrate })", () => {
  const widget = defineGristWidget({ title: "Board", requiredAccess: "full", optionsVersion: 2, migrate })

  function App() {
    const w = widget.useGrist()
    const columns = w.widgetOptions?.columns
    return <p>{Array.isArray(columns) ? columns.join(" | ") : "none"}</p>
  }

  it("shows the widget the previous version's options migrated, and saves them back", async () => {
    const r = renderWithGrist(<App />, { widget, emulator: { widgetOptions: { columns: "To do,Doing,Done" } } })
    expect(await screen.findByText("To do | Doing | Done")).toBeInTheDocument()
    await waitFor(() => expect(r.emulator.state.widgetOptions).toEqual({ columns: ["To do", "Doing", "Done"], [OPTIONS_VERSION_KEY]: 2 }))
  })

  it("refuses a version that isn't an integer from 1, and a migrate without one", () => {
    expect(() => defineGristWidget({ optionsVersion: 0 })).toThrow(/optionsVersion/)
    expect(() => defineGristWidget({ optionsVersion: 1.5 })).toThrow(/optionsVersion/)
    expect(() => defineGristWidget({ migrate })).toThrow(/needs the optionsVersion/)
  })
})
