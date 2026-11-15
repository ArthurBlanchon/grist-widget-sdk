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
    expect(readWidgetOptions({ columns: "To do,Done" }, v2)).toEqual({ options: { columns: ["To do", "Done"] }, issue: null })
    expect(readWidgetOptions({ columns: ["A"], __version: 2 }, v2)).toEqual({ options: { columns: ["A"] }, issue: null })
  })

  it("leaves options from a newer version as written, with the issue", () => {
    const read = readWidgetOptions({ columns: ["A"], v3only: 1, __version: 3 }, v2)
    expect(read.options).toEqual({ columns: ["A"], v3only: 1 })
    expect(read.issue).toMatch(/newer version of this widget \(3, this is 2\)/)
  })

  it("starts an empty section at the current version, and passes null through", () => {
    const spy = vi.fn(migrate)
    expect(readWidgetOptions({}, { optionsVersion: 3, migrate: spy })).toEqual({ options: {}, issue: null })
    expect(spy).not.toHaveBeenCalled()
    expect(readWidgetOptions(null, v2).options).toBeNull()
  })

  it("keeps the options as written, with the issue, when migrate throws or returns no plain object", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    for (const [i, broken] of [
      () => {
        throw new Error("no")
      },
      () => undefined,
      () => [],
      () => Promise.resolve({}),
      () => new Map(),
    ].entries()) {
      const read = readWidgetOptions({ columns: "A,B", n: i }, { optionsVersion: 2, migrate: broken as never })
      expect(read.options).toEqual({ columns: "A,B", n: i })
      expect(read.issue).toMatch(/couldn't be migrated/)
    }
  })

  it("leaves a widget without optionsVersion its options untouched, the key included", () => {
    expect(readWidgetOptions({ a: 1, __version: 7 }, {})).toEqual({ options: { a: 1, __version: 7 }, issue: null })
  })

  it("can't read a version that isn't an integer from 1: an issue, not a migration", () => {
    const spy = vi.fn(migrate)
    for (const bad of [0, -1, "2", 2.5]) {
      const read = readWidgetOptions({ columns: "A", __version: bad }, { optionsVersion: 2, migrate: spy })
      expect(read.issue, String(bad)).toMatch(/version this widget can't read/)
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it("gives migrate a deep copy: changing nested values doesn't change what Grist holds", () => {
    const raw = { list: ["a"] }
    readWidgetOptions(raw, { optionsVersion: 2, migrate: (o) => ((o.list as string[]).push("x"), o) })
    expect(raw.list).toEqual(["a"])
  })
})

describe("writeWidgetOptions", () => {
  const read = (raw: Record<string, unknown> | null, v = v2) => readWidgetOptions(raw, v)

  it("writes under the current version; untouched without one", () => {
    expect(writeWidgetOptions({ columns: ["A"] }, read({ columns: "A" }), v2)).toEqual({ columns: ["A"], [OPTIONS_VERSION_KEY]: 2 })
    expect(writeWidgetOptions({ a: 1 }, read(null, {}), {})).toEqual({ a: 1 })
  })

  it("refuses to write over a newer version's options, or options it couldn't migrate; an empty write resets them", () => {
    expect(() => writeWidgetOptions({ x: 1 }, read({ columns: ["A"], __version: 3 }), v2)).toThrow(/newer version/)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const broken = { optionsVersion: 2, migrate: () => { throw new Error("no") } }
    expect(() => writeWidgetOptions({ x: 1 }, read({ columns: "A,B" }, broken), broken)).toThrow(/couldn't be migrated/)
    expect(writeWidgetOptions({}, read({ columns: ["A"], __version: 3 }), v2)).toEqual({ [OPTIONS_VERSION_KEY]: 2 })
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
    expect(() => defineGristWidget({ optionsVersion: 2 })).toThrow(/needs migrate/)
  })
})
