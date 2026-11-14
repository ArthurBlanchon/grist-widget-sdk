/**
 * Deprecations: a deprecated name keeps working, warns once in development
 * with what replaces it, and stays silent in a production build.
 */
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"

import * as actions from "../../src/actions"
import * as sdk from "../../src/sdk"
import { resetDeprecationWarnings, warnDeprecated } from "../../src/sdk/helpers/deprecate"
import { cleanup, presets, renderWithGrist, screen, smokeTestWidget, waitFor } from "../../src/emulator/testing"
import type { GristColumnarTable, GristRowRecord, UseGristResult } from "../../src/sdk"

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  resetDeprecationWarnings()
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
  vi.unstubAllEnvs()
  cleanup()
})
const lines = () => warn.mock.calls.map((c: unknown[]) => String(c[0]))

describe("warnDeprecated", () => {
  it("warns once per name, saying what to use instead", () => {
    warnDeprecated("old()", "use new()")
    warnDeprecated("old()", "use new()")
    expect(lines()).toEqual([expect.stringContaining("old() is deprecated and goes in 1.0: use new()")])
  })

  it("is silent in a production build", () => {
    vi.stubEnv("NODE_ENV", "production")
    warnDeprecated("old()", "use new()")
    expect(lines()).toEqual([])
  })
})

describe("the user-action builders in the root entry", () => {
  it("build the same tuple as grist-widget-sdk/actions, warning once", () => {
    expect(sdk.gristAddColumnAction("T", "A", { type: "Text" })).toEqual(actions.gristAddColumnAction("T", "A", { type: "Text" }))
    expect(sdk.gristUpdateRecordAction("T", 1, { A: 1 })).toEqual(["UpdateRecord", "T", 1, { A: 1 }])
    sdk.gristAddColumnAction("T", "B", {})
    expect(lines()).toEqual([
      expect.stringContaining('gristAddColumnAction from "grist-widget-sdk" is deprecated'),
      expect.stringContaining('gristUpdateRecordAction from "grist-widget-sdk" is deprecated'),
    ])
    expect(lines()[0]).toContain('"grist-widget-sdk/actions"')
  })

  it("are silent from grist-widget-sdk/actions", () => {
    actions.gristRenameColumnAction("T", "A", "B")
    expect(lines()).toEqual([])
  })
})

describe("useGristContext", () => {
  it("still returns useGrist() inside the provider, warning once", async () => {
    function Probe() {
      const w = sdk.useGristContext()
      return <span>{w.status}</span>
    }
    renderWithGrist(
      <sdk.GristWidgetProvider options={{ requiredAccess: "read table" }}>
        <Probe />
      </sdk.GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy())
    expect(lines()).toEqual([expect.stringContaining("useGristContext() is deprecated")])
  })
})

describe("a widget on the current API", () => {
  it("logs no deprecation warning, the SDK's own hooks and components included", async () => {
    const widget = sdk.defineGristWidget({ requiredAccess: "full", columns: [{ name: "Title", type: "Text" }] })
    function App() {
      const w = widget.useGrist()
      const schema = sdk.useGristSchema({ tableId: w.currentTableId ?? undefined })
      return (
        <p>
          {w.status} {w.mappedRecord?.Title} {schema.loading ? "…" : Object.keys(schema.table?.columns ?? {}).length}
        </p>
      )
    }
    await smokeTestWidget({ App, widget })
    expect(lines()).toEqual([])
  })
})

describe("fetchRows types", () => {
  it("gives rows by default and columns with { columnar: true }", () => {
    type W = UseGristResult
    const w = {} as W
    const rows = () => w.fetchRows()
    expectTypeOf(rows).returns.resolves.toEqualTypeOf<GristRowRecord<Record<string, unknown>>[]>()
    const typed = () => w.fetchRows<{ Name: string }>("People")
    const columnar = () => w.fetchRows({ columnar: true })
    const columnarOf = () => w.fetchRows("People", { columnar: true })
    expectTypeOf(typed).returns.resolves.toEqualTypeOf<GristRowRecord<{ Name: string }>[]>()
    expectTypeOf(columnar).returns.resolves.toEqualTypeOf<GristColumnarTable>()
    expectTypeOf(columnarOf).returns.resolves.toEqualTypeOf<GristColumnarTable>()
  })
})

describe("the page-wide connection (0.7)", () => {
  it("still connects useGrist() outside a provider, warning once with what to do instead", async () => {
    function Probe() {
      const w = sdk.useGrist()
      return <span>{w.status}</span>
    }
    renderWithGrist(<Probe />, { emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy())
    expect(lines()).toEqual([expect.stringContaining("useGrist() outside <GristWidgetProvider> is deprecated")])
    expect(lines()[0]).toContain("renderWithGrist(<App />, { widget })")
    expect(lines()[0]).toContain("useGristOptional()")
  })

  it("is silent inside the provider renderWithGrist renders for a declaration", async () => {
    const widget = sdk.defineGristWidget({ requiredAccess: "read table" })
    function App() {
      const w = sdk.useGrist()
      return <span>{w.status}</span>
    }
    renderWithGrist(<App />, { widget })
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy())
    expect(lines()).toEqual([])
  })

  it("leaves useGristOptional() silent outside a provider", () => {
    function Probe() {
      return <span>{sdk.useGristOptional() === null ? "none" : "some"}</span>
    }
    renderWithGrist(<Probe />)
    expect(screen.getByText("none")).toBeTruthy()
    expect(lines()).toEqual([])
  })
})

describe("useGristSchema's connection options (0.7)", () => {
  it("warns once, naming the options passed, and still reads the schema", async () => {
    const widget = sdk.defineGristWidget({ requiredAccess: "full" })
    function App() {
      const schema = sdk.useGristSchema({ requiredAccess: "full", allowSelectBy: true })
      return <span>{schema.loading ? "loading" : "loaded"}</span>
    }
    renderWithGrist(<App />, { widget, emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByText("loaded")).toBeTruthy())
    expect(lines()).toEqual([expect.stringContaining("useGristSchema({ requiredAccess, allowSelectBy }) is deprecated")])
    expect(lines()[0]).toContain("defineGristWidget()")
  })

  it("is silent with schema options only", async () => {
    const widget = sdk.defineGristWidget({ requiredAccess: "full" })
    function App() {
      const schema = sdk.useGristSchema({ sampleRowLimit: 3 })
      return <span>{schema.loading ? "loading" : "loaded"}</span>
    }
    renderWithGrist(<App />, { widget, emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByText("loaded")).toBeTruthy())
    expect(lines()).toEqual([])
  })
})
