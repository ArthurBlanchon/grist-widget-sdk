import { describe, expect, it } from "vitest"

import {
  applyUserActions,
  createDocument,
  createEventBus,
  evaluateRowFormulas,
  getTable,
} from "../../src/emulator/core"

function makeFixture() {
  const bus = createEventBus()
  const state = createDocument({
    generatedAt: "2026-01-01T00:00:00.000Z",
    docName: "Doc",
    tables: {
      Tasks: {
        columns: {
          title: { type: "Text" },
          done: { type: "Bool" },
        },
        rows: [
          { id: 1, title: "Buy milk", done: false },
          { id: 2, title: "Ship SDK", done: true },
        ],
      },
    },
  })
  return { bus, state }
}

describe("action engine", () => {
  it("AddRecord allocates a new id and emits data-change", () => {
    const { bus, state } = makeFixture()
    const result = applyUserActions(state, bus, [
      ["AddRecord", "Tasks", null, { title: "New", done: false }],
    ])
    expect(result.retValues).toEqual([3])
    expect(state.tables.get("Tasks")!.rows.length).toBe(3)
    expect(bus.history()).toContainEqual({ type: "data-change", tableId: "Tasks" })
  })

  it("UpdateRecord mutates an existing row", () => {
    const { bus, state } = makeFixture()
    applyUserActions(state, bus, [["UpdateRecord", "Tasks", 1, { title: "Buy oat" }]])
    expect(state.tables.get("Tasks")!.rows[0].title).toBe("Buy oat")
  })

  it("RemoveRecord drops the row and resets selection if needed", () => {
    const { bus, state } = makeFixture()
    state.selection.rowId = 1
    applyUserActions(state, bus, [["RemoveRecord", "Tasks", 1]])
    expect(state.tables.get("Tasks")!.rows.find((r) => r.id === 1)).toBeUndefined()
    expect(state.selection.rowId).toBe(2)
  })

  it("BulkAddRecord allocates ids for null entries", () => {
    const { bus, state } = makeFixture()
    const result = applyUserActions(state, bus, [
      ["BulkAddRecord", "Tasks", [null, null], { title: ["A", "B"], done: [false, false] }],
    ])
    expect(result.retValues[0]).toEqual([3, 4])
  })

  it("BulkUpdateRecord updates multiple rows", () => {
    const { bus, state } = makeFixture()
    applyUserActions(state, bus, [
      ["BulkUpdateRecord", "Tasks", [1, 2], { title: ["X", "Y"] }],
    ])
    expect(state.tables.get("Tasks")!.rows.map((r) => r.title)).toEqual(["X", "Y"])
  })

  it("AddColumn / RemoveColumn / RenameColumn mutate schema", () => {
    const { bus, state } = makeFixture()
    applyUserActions(state, bus, [["AddColumn", "Tasks", "priority", { type: "Choice" }]])
    expect(state.tables.get("Tasks")!.columns.priority).toEqual({ type: "Choice" })

    applyUserActions(state, bus, [["RenameColumn", "Tasks", "priority", "rank"]])
    expect(state.tables.get("Tasks")!.columns.rank).toEqual({ type: "Choice" })
    expect(state.tables.get("Tasks")!.columns.priority).toBeUndefined()

    applyUserActions(state, bus, [["RemoveColumn", "Tasks", "rank"]])
    expect(state.tables.get("Tasks")!.columns.rank).toBeUndefined()
  })

  it("emits user-action events for every applied action", () => {
    const { bus, state } = makeFixture()
    applyUserActions(state, bus, [
      ["AddRecord", "Tasks", null, { title: "X" }],
      ["UpdateRecord", "Tasks", 1, { done: true }],
    ])
    const userActions = bus.history().filter((e) => e.type === "user-action")
    expect(userActions).toHaveLength(2)
  })

  it("rejects unknown actions clearly", () => {
    const { bus, state } = makeFixture()
    expect(() => applyUserActions(state, bus, [["UnknownAction"] as unknown[]])).toThrow(
      /Unsupported user action/
    )
  })

  it("evaluates formula columns on insert and update", () => {
    const bus = createEventBus()
    const state = createDocument({
      generatedAt: "2026-01-01T00:00:00.000Z",
      docName: "X",
      tables: {
        T: {
          columns: {
            a: { type: "Numeric" },
            b: { type: "Numeric" },
            sum: {
              type: "Numeric",
              isFormula: true,
              formula: "$a + $b",
              formulaFn: (row) => Number(row.a ?? 0) + Number(row.b ?? 0),
            },
          },
          rows: [],
        },
      },
    })
    const sumCol = state.tables.get("T")!.columns.sum
    expect(sumCol.formula).toBe("$a + $b")
    expect(sumCol.inferredFormula).toBe("$a + $b")
    expect(typeof sumCol.formulaFn).toBe("function")

    applyUserActions(state, bus, [["AddRecord", "T", null, { a: 2, b: 3 }]])
    expect(state.tables.get("T")!.rows[0].sum).toBe(5)
    applyUserActions(state, bus, [["UpdateRecord", "T", 1, { a: 10 }]])
    expect(state.tables.get("T")!.rows[0].sum).toBe(13)
  })

  it("formulaFn without replica formula still stores inferredFormula placeholder", () => {
    const state = createDocument({
      generatedAt: "2026-01-01T00:00:00.000Z",
      docName: "Y",
      tables: {
        T: {
          columns: {
            x: { type: "Numeric" },
            y: {
              type: "Numeric",
              isFormula: true,
              formulaFn: (row) => Number(row.x ?? 0) * 2,
            },
          },
          rows: [{ id: 1, x: 4 }],
        },
      },
    })
    const y = state.tables.get("T")!.columns.y
    expect(y.formula).toBeUndefined()
    expect(y.inferredFormula).toBe("(emulator JavaScript formula)")
    const table = getTable(state, "T")
    evaluateRowFormulas(state, table, table.rows[0])
    expect(table.rows[0].y).toBe(8)
  })

  it("honours explicit inferredFormula when different from formula", () => {
    const state = createDocument({
      generatedAt: "2026-01-01T00:00:00.000Z",
      docName: "Z",
      tables: {
        T: {
          columns: {
            n: { type: "Numeric" },
            d: {
              type: "Numeric",
              isFormula: true,
              formula: "n * 2",
              inferredFormula: "=n*2 (display)",
              formulaFn: (row) => Number(row.n ?? 0) * 2,
            },
          },
          rows: [{ id: 1, n: 3 }],
        },
      },
    })
    const d = state.tables.get("T")!.columns.d
    expect(d.formula).toBe("n * 2")
    expect(d.inferredFormula).toBe("=n*2 (display)")
  })

  it("syncs RefList gristHelper labels after UpdateRecord when helper has only a Grist formula string", () => {
    const bus = createEventBus()
    const state = createDocument({
      generatedAt: "2026-01-01T00:00:00.000Z",
      docName: "D",
      tables: {
        Tags: {
          columns: {
            Nom: { type: "Text", parentPos: 1 },
          },
          rows: [
            { id: 1, Nom: "Alpha" },
            { id: 2, Nom: "Beta" },
          ],
        },
        People: {
          columns: {
            tags: {
              type: "RefList:Tags",
              parentPos: 2,
              displayColRef: 3,
            },
            gristHelper_tags: {
              colRef: 3,
              type: "Any",
              parentPos: 3,
              isFormula: true,
              formula: "$tags.Nom",
            },
          },
          rows: [{ id: 10, tags: ["L", 1], gristHelper_tags: ["stale"] }],
        },
      },
    })

    applyUserActions(state, bus, [["UpdateRecord", "People", 10, { tags: ["L", 1, 2] }]])
    const row = getTable(state, "People").rows[0]
    expect(row.tags).toEqual(["L", 1, 2])
    expect(row.gristHelper_tags).toEqual(["Alpha", "Beta"])
  })
})
