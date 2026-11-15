/**
 * Widget options that evolve: defineGristWidget({ optionsVersion, migrate }).
 * Migrated on read, in memory; stamped with the version when the widget
 * writes; never written over when newer or not migrated.
 */
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defineGristWidget } from "../../src/sdk"
import { OPTIONS_VERSION_KEY, readWidgetOptions, writeWidgetOptions } from "../../src/sdk/runtime/options-version"
import { cleanup, renderWithGrist, screen, waitFor } from "../../src/emulator/testing"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// v1 kept the board's columns as one comma-separated string; v2 as a list.
const migrate = (options: Record<string, unknown>, from: number) =>
  from < 2 && typeof options.columns === "string" ? { ...options, columns: options.columns.split(",") } : options
const v2 = { optionsVersion: 2, migrate }

describe("readWidgetOptions", () => {
  it("migrates options without a version as version 1, and hides the version", () => {
    expect(readWidgetOptions({ columns: "To do,Done" }, v2)).toEqual({ options: { columns: ["To do", "Done"] }, from: 1, writable: true })
    expect(readWidgetOptions({ columns: ["A"], __version: 2 }, v2)).toEqual({ options: { columns: ["A"] }, from: 2, writable: true })
  })

  it("leaves options from a newer version as written, and not writable", () => {
    expect(readWidgetOptions({ columns: ["A"], v3only: 1, __version: 3 }, v2)).toEqual({ options: { columns: ["A"], v3only: 1 }, from: 3, writable: false })
  })

  it("starts an empty section at the current version, and passes null through", () => {
    const spy = vi.fn(migrate)
    expect(readWidgetOptions({}, { optionsVersion: 3, migrate: spy })).toEqual({ options: {}, from: 3, writable: true })
    expect(spy).not.toHaveBeenCalled()
    expect(readWidgetOptions(null, v2).options).toBeNull()
  })

  it("keeps the options as written, not writable, when migrate throws or returns no object", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    for (const broken of [
      () => {
        throw new Error("no")
      },
      () => undefined as unknown as Record<string, unknown>,
      () => [] as unknown as Record<string, unknown>,
    ]) {
      expect(readWidgetOptions({ columns: "A,B" }, { optionsVersion: 2, migrate: broken })).toEqual({ options: { columns: "A,B" }, from: 1, writable: false })
    }
  })

  it("reads a version below 1 as 1, and hides the key even without a declared version", () => {
    const spy = vi.fn(migrate)
    readWidgetOptions({ columns: "A", __version: 0 }, { optionsVersion: 2, migrate: spy })
    expect(spy).toHaveBeenCalledWith({ columns: "A" }, 1)
    expect(readWidgetOptions({ a: 1, __version: 7 }, {}).options).toEqual({ a: 1 })
  })
})

describe("writeWidgetOptions", () => {
  it("writes under the current version", () => {
    expect(writeWidgetOptions({ columns: ["A"] }, { columns: "A" }, v2)).toEqual({ columns: ["A"], [OPTIONS_VERSION_KEY]: 2 })
    expect(writeWidgetOptions({ a: 1 }, null, {})).toEqual({ a: 1 })
  })

  it("refuses to write over a newer version's options, or options it couldn't migrate", () => {
    expect(() => writeWidgetOptions({ x: 1 }, { columns: ["A"], __version: 3 }, v2)).toThrow(/newer version/)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const broken = () => {
      throw new Error("no")
    }
    expect(() => writeWidgetOptions({ x: 1 }, { columns: "A,B" }, { optionsVersion: 2, migrate: broken })).toThrow(/couldn't be migrated/)
  })
})

describe("defineGristWidget({ optionsVersion, migrate })", () => {
  const widget = defineGristWidget({ title: "Board", requiredAccess: "full", ...v2 })

  function App() {
    const w = widget.useGrist()
    const columns = w.widgetOptions?.columns
    return (
      <>
        <p>{Array.isArray(columns) ? columns.join(" | ") : "none"}</p>
        <button onClick={() => void w.patchWidgetOptions({ compact: true })}>compact</button>
      </>
    )
  }

  it("shows the previous version's options migrated, without writing them on load", async () => {
    const r = renderWithGrist(<App />, { widget, emulator: { widgetOptions: { columns: "To do,Doing,Done" } } })
    expect(await screen.findByText("To do | Doing | Done")).toBeInTheDocument()
    expect(r.emulator.state.widgetOptions).toEqual({ columns: "To do,Doing,Done" })
  })

  it("merges a patch into the migrated options, under the current version", async () => {
    const r = renderWithGrist(<App />, { widget, emulator: { widgetOptions: { columns: "To do,Done" } } })
    ;(await screen.findByText("compact")).click()
    await waitFor(() => expect(r.emulator.state.widgetOptions).toEqual({ columns: ["To do", "Done"], compact: true, __version: 2 }))
  })

  it("refuses a version that isn't an integer from 1, and a migrate without one", () => {
    expect(() => defineGristWidget({ optionsVersion: 0 })).toThrow(/optionsVersion/)
    expect(() => defineGristWidget({ optionsVersion: 1.5 })).toThrow(/optionsVersion/)
    expect(() => defineGristWidget({ migrate })).toThrow(/needs the optionsVersion/)
  })
})
