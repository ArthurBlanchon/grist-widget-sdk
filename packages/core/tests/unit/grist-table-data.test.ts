import { describe, expect, it } from "vitest"

import { fetchGristTableRows, materializeGristRowsFromColumnar, tableDataToRows } from "../../src/sdk/helpers/grist-table-data"
import type { GristDocApi } from "../../src/sdk/types"

describe("table data", () => {
  it("decodes cells with column metadata", () => {
    const rows = materializeGristRowsFromColumnar({ id: [1], due: [1_704_067_200] }, { columns: { due: { type: "Date" } } })
    expect(rows[0]?.due).toBeInstanceOf(Date)
  })

  it("orders rows like Grist (manualSort, then id), by id, or as fetched", async () => {
    const data = { id: [3, 1, 2], manualSort: [1, 3, 2], name: ["c", "a", "b"] }
    const docApi = { fetchTable: async () => data } as unknown as GristDocApi
    expect((await fetchGristTableRows(docApi, "T")).map((r) => r.name)).toEqual(["c", "b", "a"])
    expect((await fetchGristTableRows(docApi, "T", { order: "id" })).map((r) => r.name)).toEqual(["a", "b", "c"])
    expect((await fetchGristTableRows(docApi, "T", { order: "none" })).map((r) => r.name)).toEqual(["c", "a", "b"])
  })

  it("turns columns into rows", () => {
    expect(tableDataToRows({ id: [1, 2], Name: ["a", "b"] })).toEqual([
      { id: 1, Name: "a" },
      { id: 2, Name: "b" },
    ])
    expect(tableDataToRows({})).toEqual([])
  })
})
