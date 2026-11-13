import { describe, expect, it } from "vitest"

import { loadColumnMetadataByTable } from "../../src/sdk/helpers/build-replica-document"
import { coerceGristDocApiRefRowId } from "../../src/sdk/helpers/grist-value-codec"
import type { GristDocApi } from "../../src/sdk/types"

describe("coerceGristDocApiRefRowId", () => {
  it("accepts numeric ids", () => {
    expect(coerceGristDocApiRefRowId(42)).toBe(42)
  })

  it("extracts row id from R tuple", () => {
    expect(coerceGristDocApiRefRowId(["R", "_grist_Tables", 7])).toBe(7)
  })

  it("extracts row id from r tuple", () => {
    expect(coerceGristDocApiRefRowId(["r", 99])).toBe(99)
  })

  it("returns undefined for unrelated values", () => {
    expect(coerceGristDocApiRefRowId("x")).toBeUndefined()
    expect(coerceGristDocApiRefRowId(["L", 1, 2])).toBeUndefined()
  })
})

describe("loadColumnMetadataByTable + Ref-shaped cells", () => {
  it("maps _grist_Tables_column when parentId is an R tuple", async () => {
    const docApi: Pick<GristDocApi, "fetchTable"> = {
      async fetchTable(tableId: string): Promise<Record<string, unknown[]>> {
        if (tableId === "_grist_Tables") {
          return {
            id: [10],
            tableId: ["Tasks"],
          }
        }
        if (tableId === "_grist_Tables_column") {
          return {
            id: [101],
            parentId: [["R", "_grist_Tables", 10]],
            colId: ["title"],
            parentPos: [3],
            type: ["Text"],
            label: ["Title"],
            isFormula: [false],
            formula: [""],
            widgetOptions: [""],
          }
        }
        return {}
      },
    }
    const byTable = await loadColumnMetadataByTable(docApi as GristDocApi)
    expect(byTable.get("Tasks")?.get("title")).toEqual({
      colRef: 101,
      type: "Text",
      label: "Title",
      parentPos: 3,
      isFormula: false,
      formula: "",
      description: undefined,
      widgetOptions: undefined,
      displayColRef: undefined,
      visibleColRef: undefined,
    })
  })
})
