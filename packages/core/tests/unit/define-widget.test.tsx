/**
 * defineGristWidget: one declaration types the widget, mounts it and tests it.
 */
import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, expectTypeOf, it } from "vitest"

import { defineGristWidget, type GristWidgetRow } from "../../src/sdk"
import { entryProps } from "../../src/app"
import { actionsOf, cleanup, fireEvent, renderWithGrist, screen, smokeTestWidget, waitFor } from "../../src/emulator/testing"

afterEach(() => cleanup())

const widget = defineGristWidget({
  title: "Tasks",
  description: "Mark the selected task done.",
  requiredAccess: "full",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Done", type: "Bool" },
    { name: "Tags", type: "ChoiceList", optional: true },
  ],
})

function App() {
  const w = widget.useGrist()
  if (w.mode !== "row" || !w.mappedRecord) return <p>Select a task.</p>
  const task = w.mappedRecord
  return (
    <label>
      <input type="checkbox" checked={!!task.Done} onChange={(e) => void w.updateRecord({ Done: e.target.checked })} />
      {task.Title}
    </label>
  )
}

describe("defineGristWidget", () => {
  it("types the mapped record from the declaration, with no annotation", () => {
    type Row = GristWidgetRow<typeof widget>
    expectTypeOf<Row["Title"]>().toEqualTypeOf<string | null>()
    expectTypeOf<Row["Done"]>().toEqualTypeOf<boolean | null>()
    expectTypeOf<Row["Tags"]>().toEqualTypeOf<string[] | null | undefined>()
    expectTypeOf<Parameters<ReturnType<typeof widget.useGrist>["addRecord"]>[0]>().toEqualTypeOf<{
      Title?: string | null
      Done?: boolean | null
      Tags?: string[] | null
    }>()
  })

  it("splits the declaration into options and metadata", () => {
    expect(widget.options).toEqual({ requiredAccess: "full", columns: widget.definition.columns })
    expect(widget.metadata).toEqual({ title: "Tasks", description: "Mark the selected task done." })
  })
})

describe("renderWithGrist({ widget, rows })", () => {
  it("runs the widget against its declared columns, mapped, with typed rows, and records its writes", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows: [{ Title: "Ship", Done: false, Tags: ["work"] }] })
    const box = await screen.findByRole("checkbox")
    expect(screen.getByText("Ship")).toBeInTheDocument()
    fireEvent.click(box)
    await waitFor(() => expect(emulator.state.tables.get("Table1")!.rows[0]).toMatchObject({ Done: true, Tags: ["L", "work"] }))
    expect(actionsOf(emulator).length).toBeGreaterThan(0)
  })
})

describe("smokeTestWidget", () => {
  it("renders the declared widget", () => smokeTestWidget({ App, widget }))
  it("takes the entry module, as mountGristWidget does", () => smokeTestWidget({ default: App, widget }))
  it("takes an older entry module with GRIST_OPTIONS", () => smokeTestWidget({ default: App, GRIST_OPTIONS: widget.options }))
})

describe("entryProps (what mountGristWidget reads from src/app/App.tsx)", () => {
  it("takes the declaration, and the pages a widget replaces", () => {
    const ReleasePage = () => null
    const props = entryProps({ default: App, widget, ReleasePage, Alerts: null }, true)
    expect(props).toMatchObject({ App, options: widget.options, metadata: widget.metadata, dev: true, ReleasePage, Alerts: null })
  })

  it("still takes GRIST_OPTIONS and WIDGET_METADATA, and keeps the default pages", () => {
    const options = { requiredAccess: "read table" as const }
    const props = entryProps({ default: App, GRIST_OPTIONS: options, WIDGET_METADATA: { title: "Old" } })
    expect(props).toEqual({ App, options, metadata: { title: "Old" }, dev: false })
  })

  it("says what is missing", () => {
    expect(() => entryProps({ default: App })).toThrow(/neither `widget`.*nor `GRIST_OPTIONS`/)
  })
})
