// A declared reference column reads as its row id, whatever its column
// shows: the SDK asks Grist for ids (expandRefs: false) when the widget
// declares a column that accepts a reference and not text.
import { screen } from "@testing-library/react"
import { useEffect, useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { defineGristWidget, type GristReplicaDocument } from "../../src/sdk"
import { renderWithGrist } from "../../src/emulator/testing"
import { declaresReferences } from "../../src/sdk/runtime/host"

const document: GristReplicaDocument = {
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Jobs",
  mode: "schema+data",
  tables: {
    Jobs: {
      columns: {
        Owner: { type: "Ref:People", colRef: 1, visibleColRef: 20 },
        Badge: { type: "Ref:People", colRef: 2, visibleColRef: 21 },
        Team: { type: "RefList:People", colRef: 3, visibleColRef: 20 },
      },
      rows: [{ id: 1, Owner: 2, Badge: 1, Team: ["L", 1, 2] }],
    },
    People: {
      columns: { Name: { type: "Text", colRef: 20 }, Number: { type: "Numeric", colRef: 21 } },
      rows: [
        { id: 1, Name: "Léa", Number: 7 },
        { id: 2, Name: "Marc", Number: 9 },
      ],
    },
  },
  selection: { tableId: "Jobs", rowId: 1 },
}

describe("declaresReferences", () => {
  it("is true for a column that accepts a reference and not text", () => {
    expect(declaresReferences([{ name: "A", type: "Ref:People" }])).toBe(true)
    expect(declaresReferences([{ name: "A", type: "RefList:People" }])).toBe(true)
    expect(declaresReferences([{ name: "A", type: "Text,Ref" }])).toBe(false)
    expect(declaresReferences([{ name: "A", type: "Text" }, "B"])).toBe(false)
    expect(declaresReferences(undefined)).toBe(false)
  })
})

describe("a declared reference column", () => {
  it("reads as its row id, whether its column shows a name or a number", async () => {
    const widget = defineGristWidget({
      requiredAccess: "read table",
      columns: [
        { name: "Owner", type: "Ref:People" },
        { name: "Badge", type: "Ref:People" },
        { name: "Team", type: "RefList:People" },
      ],
    })
    function App() {
      const w = widget.useGrist()
      const r = w.mappedRecord
      return <p>{r ? `${r.Owner}|${r.Badge}|${(r.Team ?? []).join(",")}|raw ${String(w.record?.Owner)}|${w.cellIssues.length}` : JSON.stringify([w.record, w.cellIssues])}</p>
    }
    renderWithGrist(<App />, { widget, emulator: { document } })
    // Marc is row 2, Léa row 1: never the shown 9 or 7.
    expect(await screen.findByText("2|1|1,2|raw 2|0")).toBeTruthy()
  })

  it("declared Text,Ref keeps the text its column shows", async () => {
    const widget = defineGristWidget({ requiredAccess: "read table", columns: [{ name: "Owner", type: "Text,Ref" }] })
    function App() {
      const w = widget.useGrist()
      return <p>{w.mappedRecord ? `owner ${w.mappedRecord.Owner}` : "none"}</p>
    }
    renderWithGrist(<App />, { widget, emulator: { document } })
    expect(await screen.findByText("owner Marc")).toBeTruthy()
  })

  it("fetchRows() gives the same ids as w.records", async () => {
    const widget = defineGristWidget({ requiredAccess: "read table", columns: [{ name: "Owner", type: "Ref:People" }] })
    function App() {
      const w = widget.useGrist()
      const [rows, setRows] = useState<string>("…")
      useEffect(() => {
        void w.fetchRows().then((r) => setRows(r.map((row) => String(row.Owner)).join(",")))
      }, [w.fetchRows])
      return <p>{`rows ${rows} records ${w.records?.map((r) => String(r.Owner)).join(",")}`}</p>
    }
    renderWithGrist(<App />, { widget, emulator: { document } })
    expect(await screen.findByText("rows 2 records 2")).toBeTruthy()
  })

  it("mixed with a Text,Ref column, that one reads the id too, and the SDK says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const widget = defineGristWidget({
      requiredAccess: "read table",
      columns: [
        { name: "Owner", type: "Ref:People" },
        { name: "Badge", type: "Text,Ref" },
      ],
    })
    function App() {
      const w = widget.useGrist()
      return <p>{w.mappedRecord ? `${w.mappedRecord.Owner}|${w.mappedRecord.Badge}` : "none"}</p>
    }
    renderWithGrist(<App />, { widget, emulator: { document } })
    expect(await screen.findByText("2|1")).toBeTruthy()
    expect(warn.mock.calls.some(([m]) => String(m).includes("Text,Ref column reads the id"))).toBe(true)
    warn.mockRestore()
  })
})
