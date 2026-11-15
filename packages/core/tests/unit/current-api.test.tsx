/**
 * The current API only: `useGrist()` needs the provider, the user-action
 * builders live in `grist-widget-sdk/actions`, and a widget written against
 * it logs nothing.
 */
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest"

import * as actions from "../../src/actions"
import * as sdk from "../../src/sdk"
import { cleanup, presets, renderWithGrist, screen, smokeTestWidget, waitFor } from "../../src/emulator/testing"
import type { GristColumnarTable, GristRowRecord, UseGristResult } from "../../src/sdk"

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
  cleanup()
})
const lines = () => warn.mock.calls.map((c: unknown[]) => String(c[0]))

describe("useGrist() outside <GristWidgetProvider>", () => {
  it("throws, saying where the provider comes from", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      function Probe() {
        return <span>{sdk.useGrist().status}</span>
      }
      expect(() => renderWithGrist(<Probe />, { emulator: { document: presets.todoList() } })).toThrow(
        /must be used inside <GristWidgetProvider>.*renderWithGrist\(<App \/>, \{ widget \}\).*useGristOptional\(\)/
      )
    } finally {
      error.mockRestore()
    }
  })

  it("leaves useGristOptional() returning null", () => {
    function Probe() {
      return <span>{sdk.useGristOptional() === null ? "none" : "some"}</span>
    }
    renderWithGrist(<Probe />)
    expect(screen.getByText("none")).toBeTruthy()
  })

  it("connects inside the provider renderWithGrist renders for a declaration", async () => {
    const widget = sdk.defineGristWidget({ requiredAccess: "read table" })
    function App() {
      return <span>{sdk.useGrist().status}</span>
    }
    renderWithGrist(<App />, { widget })
    await waitFor(() => expect(screen.getByText("ready")).toBeTruthy())
  })
})

describe("the user-action builders", () => {
  it("are in grist-widget-sdk/actions, not the root entry", () => {
    expect(actions.gristUpdateRecordAction("T", 1, { A: 1 })).toEqual(["UpdateRecord", "T", 1, { A: 1 }])
    expect("gristUpdateRecordAction" in sdk).toBe(false)
  })
})

describe("a widget on the current API", () => {
  it("logs no warning, the SDK's own hooks and components included", async () => {
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
