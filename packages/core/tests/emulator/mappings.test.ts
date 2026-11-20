/**
 * The emulator's mappings, as Grist sends them (ViewSectionRec.mappedColumns
 * and ColumnToMapImpl.canByMapped, grist-core): once the widget has declared
 * its columns, one entry per declared column, a column the table doesn't
 * have or whose base type the declaration doesn't accept left out.
 */

import { describe, expect, it } from "vitest"

import { canBeMapped, resolveMappings } from "../../src/emulator/core/mappings"
import { createGristEmulator } from "../../src/emulator"
import type { GristReplicaDocument } from "../../src/sdk"

const document: GristReplicaDocument = {
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Tasks",
  mode: "schema+data",
  tables: {
    Tasks: {
      columns: {
        Title: { type: "Text" },
        Owner: { type: "Ref:People" },
        Tags: { type: "ChoiceList" },
        Calc: { type: "Any" },
      },
      rows: [{ id: 1, Title: "Ship", Owner: 1, Tags: null, Calc: null }],
    },
    People: { columns: { Name: { type: "Text" } }, rows: [{ id: 1, Name: "Ada" }] },
  },
}

function emulatorDeclaring(columns: unknown[]) {
  const emulator = createGristEmulator({ document })
  emulator.state.configuration = { requiredAccess: "read table", columns: columns as never }
  return emulator
}

describe("canBeMapped (Grist's canByMapped)", () => {
  it("accepts a column whose base type is declared, an Any column, and anything for an Any declaration", () => {
    expect(canBeMapped({ name: "Owner", type: "Ref" }, "Ref")).toBe(true)
    expect(canBeMapped({ name: "Owner", type: "Ref:People" }, "Ref")).toBe(false)
    expect(canBeMapped({ name: "L", type: "Text, Ref" }, "Ref")).toBe(true)
    expect(canBeMapped({ name: "N", type: "Numeric" }, "Int")).toBe(false)
    expect(canBeMapped({ name: "N", type: "Numeric" }, "Any")).toBe(true)
    expect(canBeMapped({ name: "N", type: "Numeric", strictType: true }, "Any")).toBe(false)
    expect(canBeMapped("Plain", "Date")).toBe(true)
    expect(canBeMapped({ name: "X" }, "Bool")).toBe(true)
  })
})

describe("resolveMappings", () => {
  it("is the mapping as set until the widget declares its columns", () => {
    const emulator = createGristEmulator({ document })
    emulator.setColumnMappings({ Anything: "Title" })
    expect(resolveMappings(emulator.state)).toEqual({ Anything: "Title" })
  })

  it("sends every declared name, null where Grist would: a missing column, a type the declaration doesn't accept; and no undeclared name", () => {
    const emulator = emulatorDeclaring([
      { name: "Label", type: "Text" },
      { name: "Owner", type: "Ref" },
      { name: "Raw", type: "Ref:People" },
      { name: "Gone", type: "Text" },
      { name: "Unmapped", type: "Text", optional: true },
      { name: "Many", type: "Text,ChoiceList", allowMultiple: true },
    ])
    emulator.setColumnMappings({ Label: "Title", Owner: "Owner", Raw: "Owner", Gone: "Deleted", Many: ["Title", "Owner", "Tags", "Deleted"], Extra: "Title" })
    expect(resolveMappings(emulator.state)).toEqual({
      Label: "Title",
      Owner: "Owner",
      Raw: null,
      Gone: null,
      Unmapped: null,
      Many: ["Title", "Tags"],
    })
  })

  it("maps an Any column to any declaration, as Grist does", () => {
    const emulator = emulatorDeclaring([{ name: "Count", type: "Numeric" }])
    emulator.setColumnMappings({ Count: "Calc" })
    expect(resolveMappings(emulator.state)).toEqual({ Count: "Calc" })
  })
})
