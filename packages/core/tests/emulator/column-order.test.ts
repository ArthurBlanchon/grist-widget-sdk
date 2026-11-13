import { describe, expect, it } from "vitest"

import { createDocument } from "../../src/emulator/core/document"
import { rowsToColumnar } from "../../src/emulator/core/columnar"

describe("emulator column order (parentPos)", () => {
  it("orders fetchTable keys by parentPos", () => {
    const state = createDocument({
      generatedAt: "2026-01-01T00:00:00.000Z",
      tables: {
        T1: {
          rows: [
            { id: 1, z: 1, a: 2, m: 3 },
          ],
          columns: {
            z: { type: "Int", parentPos: 3 },
            a: { type: "Int", parentPos: 1 },
            m: { type: "Int", parentPos: 2 },
          },
        },
      },
    })
    const table = state.tables.get("T1")!
    const colar = rowsToColumnar(table, table.rows)
    const keys = Object.keys(colar)
    expect(keys[0]).toBe("id")
    expect(keys.slice(1)).toEqual(["a", "m", "z"])
  })
})
