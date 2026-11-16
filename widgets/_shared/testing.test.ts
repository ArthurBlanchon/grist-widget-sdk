import { describe, expect, it } from "vitest"
import { defineGristWidget, type GristWidgetDemo } from "grist-widget-sdk"

import { volumeDocument } from "./testing"

const widget = defineGristWidget({
  title: "Probe",
  description: "Probe",
  requiredAccess: "read table",
  columns: [
    { name: "Label", type: "Text" },
    { name: "Values", type: "Numeric", allowMultiple: true },
    { name: "Owner", type: "Ref:People", optional: true },
  ],
})

const demo: GristWidgetDemo = {
  tables: {
    Sales: {
      columns: { Month: "Text", Revenue: "Numeric", Costs: "Numeric", Owner: "Ref:People", Day: "Date", Tags: "ChoiceList", Files: "Attachments" },
      choices: { Tags: ["a", "b"] },
      rows: [
        { Month: "Jan", Revenue: 10, Costs: 4, Owner: 2, Day: "2026-12-01", Tags: ["a"], Files: ["x.pdf"] },
        { Month: "Feb", Revenue: 12, Costs: 5, Owner: 1, Day: "2026-12-02", Tags: [], Files: [] },
      ],
    },
    People: { columns: { Name: "Text" }, rows: [{ Name: "Ada" }, { Name: "Linus" }] },
  },
  mapping: { Label: "Month", Values: ["Revenue", "Costs"] },
}

describe("volumeDocument", () => {
  it("repeats the widget's table, keeps the others, and maps as the demo does", () => {
    const { document, mapping } = volumeDocument(widget, demo, 5)
    expect(document.tables.Sales!.rows!.map((r) => r.Month)).toEqual(["Jan", "Feb", "Jan", "Feb", "Jan"])
    expect(document.tables.People!.rows).toHaveLength(2)
    // Several columns under one declared column; a same-named one by name.
    expect(mapping).toEqual({ Label: "Month", Values: ["Revenue", "Costs"], Owner: "Owner" })
  })

  it("stores cells as Grist does, and a reference shows its target's first column", () => {
    const { document } = volumeDocument(widget, demo, 2)
    const [first, second] = document.tables.Sales!.rows!
    expect(first).toMatchObject({ id: 1, Day: Date.UTC(2026, 11, 1) / 1000, Tags: ["L", "a"], Files: null, Owner: 2 })
    expect(second).toMatchObject({ Tags: null, Files: null })
    const owner = document.tables.Sales!.columns!.Owner!
    expect(owner.visibleColRef).toBe(document.tables.People!.columns!.Name!.colRef)
    expect(document.selection).toEqual({ tableId: "Sales", rowId: 1 })
  })

  it("makes a column's value distinct on every row when asked: the worst case for grouping", () => {
    const { document } = volumeDocument(widget, demo, 3, { unique: ["Month"] })
    expect(document.tables.Sales!.rows!.map((r) => r.Month)).toEqual(["Jan 1", "Feb 2", "Jan 3"])
  })

  it("says so when the demo's table is missing or empty", () => {
    expect(() => volumeDocument(widget, { ...demo, table: "Nope" })).toThrow(/no table Nope/)
    expect(() => volumeDocument(widget, { tables: { Sales: { ...demo.tables.Sales!, rows: [] } } })).toThrow(/has no rows/)
  })
})
