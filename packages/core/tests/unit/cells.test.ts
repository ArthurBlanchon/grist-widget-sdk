/**
 * Typed reads. The values below are what Grist 1.7.22's plugin API sends a
 * widget (decoded, `keepEncoded: false`), recorded from a real document with
 * one column of each type.
 */
import { describe, expect, expectTypeOf, it } from "vitest"

import { checkGristCell, encodeGristCell, mapAndCheck, type StandardSchema } from "../../src/sdk/runtime/cells"

class Reference {
  constructor(public tableId: string, public rowId: number) {}
}
class RaisedException {
  constructor(public name: string) {}
}
class ReferenceList {
  constructor(public tableId: string, public rowIds: number[]) {}
}

const value = (type: string, v: unknown) => {
  const c = checkGristCell(type, v)
  return c.ok ? c.value : `issue: ${c.message}`
}

describe("checkGristCell", () => {
  it("passes what Grist sends for each type, as the JS value the type promises", () => {
    expect(value("Text", "hi")).toBe("hi")
    expect(value("Numeric", 1.5)).toBe(1.5)
    expect(value("Int", 3)).toBe(3)
    expect(value("Bool", true)).toBe(true)
    const d = new Date("2024-06-05T00:00:00Z")
    expect(value("Date", d)).toBe(d)
    expect(value("DateTime", new Date("2024-06-05T15:00:00Z"))).toEqual(new Date("2024-06-05T15:00:00Z"))
    expect(value("Choice", "a")).toBe("a")
    expect(value("ChoiceList", ["a", "b"])).toEqual(["a", "b"])
    expect(value("Ref:Other", new Reference("Other", 1))).toBe(1)
    expect(value("RefList:Other", [1, 2])).toEqual([1, 2])
    expect(value("RefList:Other", new ReferenceList("Other", [1, 2]))).toEqual([1, 2])
    expect(value("Attachments", [1])).toEqual([1])
    expect(value("Any", { x: 1 })).toEqual({ x: 1 })
  })

  it("gives empty cells their empty value", () => {
    expect(value("Text", null)).toBe("")
    expect(value("Int", null)).toBeNull()
    expect(value("Date", null)).toBeNull()
    expect(value("ChoiceList", null)).toEqual([])
    expect(value("Ref:Other", new Reference("Other", 0))).toBeNull()
    expect(value("RefList:Other", null)).toEqual([])
    expect(value("Attachments", null)).toEqual([])
  })

  it("reports an invalid cell (Grist keeps its text) and a formula error", () => {
    expect(value("Numeric", "not a number")).toBe("issue: not a number")
    expect(value("Int", 1.5)).toBe("issue: not an integer")
    expect(value("Date", "2024-01-01")).toBe("issue: not a date")
    expect(value("Numeric", new RaisedException("ZeroDivisionError"))).toBe("issue: formula error (ZeroDivisionError)")
    expect(value("Text", ["E", "TypeError"])).toBe("issue: formula error (TypeError)")
  })

  it("accepts any of several declared types, and reads encoded and raw forms", () => {
    expect(value("Text,Ref", "x")).toBe("x")
    expect(value("Text,Ref", new Reference("T", 4))).toBe(4)
    expect(value("Date", 1_717_545_600)).toEqual(new Date(1_717_545_600_000))
    expect(value("ChoiceList", ["L", "a"])).toEqual(["a"])
    expect(value("Ref", ["R", "T", 2])).toBe(2)
    expect(value(undefined as unknown as string, "anything")).toBe("anything")
  })
})

describe("mapAndCheck", () => {
  const columns = [
    { name: "Title", type: "Text" },
    { name: "Amount", type: "Numeric" },
    { name: "Tags", type: "ChoiceList", allowMultiple: true },
    { name: "Note", optional: true },
  ] as const

  it("maps, checks, and reports by row and column", () => {
    const { value: v, issues } = mapAndCheck(
      { id: 7, t: "x", a: "n/a", g1: ["a"], g2: null },
      columns,
      { Title: "t", Amount: "a", Tags: ["g1", "g2"] }
    )
    expect(v).toEqual({ id: 7, Title: "x", Amount: null, Tags: [["a"], []] })
    expect(issues).toEqual([{ rowId: 7, column: "Amount", message: "not a number", value: "n/a" }])
  })

  it("is null without issues while a required column is unmapped", () => {
    expect(mapAndCheck({ id: 1 }, columns, { Title: "t" })).toEqual({ value: null, issues: [] })
  })

  it("adds a Standard Schema's issues, and takes its output", () => {
    const positive: StandardSchema = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (v) => {
          const r = v as { Amount: number | null }
          return r.Amount !== null && r.Amount < 0
            ? { issues: [{ message: "must be positive", path: ["Amount"] }] }
            : { value: { ...(v as object), checked: true } }
        },
      },
    }
    const map = { Title: "t", Amount: "a", Tags: ["g1"] }
    expect(mapAndCheck({ id: 1, t: "x", a: -2, g1: [] }, columns, map, positive).issues).toEqual([
      { rowId: 1, column: "Amount", message: "must be positive", value: -2 },
    ])
    expect(mapAndCheck({ id: 1, t: "x", a: 2, g1: [] }, columns, map, positive).value).toMatchObject({ checked: true })
  })
})

describe("GristMappedRow", () => {
  it("types a declaration's mapped record", () => {
    const _options = {
      columns: [
        { name: "Title", type: "Text" },
        { name: "Due", type: "Date", optional: true },
        { name: "Owner", type: "Ref:People" },
        { name: "Tags", type: "ChoiceList", allowMultiple: true },
        { name: "Mixed", type: "Text,Ref" },
        "Plain",
      ],
    } as const
    type Row = import("../../src/sdk/runtime/cells").GristMappedRow<typeof _options>
    expectTypeOf<Row["Title"]>().toEqualTypeOf<string | null>()
    expectTypeOf<Row["Due"]>().toEqualTypeOf<Date | null | undefined>()
    expectTypeOf<Row["Owner"]>().toEqualTypeOf<number | null>()
    expectTypeOf<Row["Tags"]>().toEqualTypeOf<(string[] | null)[]>()
    expectTypeOf<Row["Mixed"]>().toEqualTypeOf<string | number | null>()
    expectTypeOf<Row["Plain"]>().toEqualTypeOf<unknown>()
    expectTypeOf<Row["id"]>().toEqualTypeOf<number>()
  })
})

describe("checkGristCell, a ChoiceList's form (#133)", () => {
  it("reads a decoded list as its choices, a first \"L\" included", () => {
    expect(checkGristCell("ChoiceList", ["L", "M"], { encoded: false })).toEqual({ ok: true, value: ["L", "M"] })
  })

  it("strips the tag of an encoded list, and assumes one when the form isn't said", () => {
    expect(checkGristCell("ChoiceList", ["L", "L", "M"], { encoded: true })).toEqual({ ok: true, value: ["L", "M"] })
    expect(checkGristCell("ChoiceList", ["L", "a"])).toEqual({ ok: true, value: ["a"] })
  })

  it("reads mapped ChoiceList cells as decoded, as useGrist() gets them", () => {
    const { value } = mapAndCheck<{ Sizes: string[] }>({ id: 1, S: ["L", "M"] }, [{ name: "Sizes", type: "ChoiceList" }], { Sizes: "S" })
    expect(value?.Sizes).toEqual(["L", "M"])
  })
})

describe("checkGristCell, a decoded list starting with \"E\" (#135)", () => {
  it("reads a ChoiceList whose first choice is \"E\" as its choices, not a formula error", () => {
    expect(checkGristCell("ChoiceList", ["E", "M"], { encoded: false })).toEqual({ ok: true, value: ["E", "M"] })
    const { value, issues } = mapAndCheck<{ Grades: string[] }>({ id: 1, G: ["E", "M"] }, [{ name: "Grades", type: "ChoiceList" }], { Grades: "G" })
    expect(value?.Grades).toEqual(["E", "M"])
    expect(issues).toEqual([])
  })

  it("still reads a formula error: decoded, a RaisedException; encoded, [\"E\", name]", () => {
    expect(checkGristCell("ChoiceList", new RaisedException("TypeError"), { encoded: false })).toEqual({ ok: false, message: "formula error (TypeError)" })
    expect(checkGristCell("ChoiceList", ["E", "TypeError"], { encoded: true })).toEqual({ ok: false, message: "formula error (TypeError)" })
    expect(checkGristCell("Numeric", ["E", "ZeroDivisionError"])).toEqual({ ok: false, message: "formula error (ZeroDivisionError)" })
  })
})

describe("encodeGristCell", () => {
  it("encodes lists, dates and references the way Grist stores them", () => {
    expect(encodeGristCell("ChoiceList", ["a", "b"])).toEqual(["L", "a", "b"])
    expect(encodeGristCell("RefList:People", [3, 4])).toEqual(["L", 3, 4])
    expect(encodeGristCell("Attachments", [7])).toEqual(["L", 7])
    expect(encodeGristCell("RefList:People", [{ tableId: "People", rowId: 5 }])).toEqual(["L", 5])
    expect(encodeGristCell("Date", new Date(Date.UTC(2026, 10, 12)))).toBe(1_794_441_600)
    expect(encodeGristCell("DateTime:UTC", new Date(Date.UTC(2026, 10, 12, 9, 30)))).toBe(1_794_475_800)
    expect(encodeGristCell("Ref:People", { tableId: "People", rowId: 9 })).toBe(9)
  })

  it("leaves encoded values, other types and empty values as they are", () => {
    expect(encodeGristCell("RefList:People", ["L", 3])).toEqual(["L", 3])
    expect(encodeGristCell("Text", ["a"])).toEqual(["a"])
    expect(encodeGristCell("Ref:People", 9)).toBe(9)
    expect(encodeGristCell("Text", "x")).toBe("x")
    expect(encodeGristCell("ChoiceList", null)).toBeNull()
    expect(encodeGristCell(undefined, ["a"])).toEqual(["a"])
  })

  it("keeps a ChoiceList's first choice when it is \"L\" (#133)", () => {
    // A choice can be any text, "L" included: a ChoiceList value is always
    // a list of choices, never taken for one already encoded.
    expect(encodeGristCell("ChoiceList", ["L"])).toEqual(["L", "L"])
    expect(encodeGristCell("ChoiceList", ["L", "M", "S"])).toEqual(["L", "L", "M", "S"])
    expect(encodeGristCell("Text,ChoiceList", ["L", "XL"])).toEqual(["L", "L", "XL"])
  })

  it("passes an encoded RefList or Attachments list through when the type also accepts a ChoiceList", () => {
    expect(encodeGristCell("ChoiceList,RefList:T", ["L", 1, 2])).toEqual(["L", 1, 2])
    expect(encodeGristCell("Attachments,ChoiceList", ["L", 11])).toEqual(["L", 11])
    // Choices are text: a list of them is wrapped, a first "L" included.
    expect(encodeGristCell("ChoiceList,RefList:T", ["L", "M"])).toEqual(["L", "L", "M"])
  })

  it("picks the list encoding when one of several declared types is a list", () => {
    expect(encodeGristCell("Text,ChoiceList", ["a"])).toEqual(["L", "a"])
    expect(encodeGristCell("Text,Ref", { rowId: 2 })).toBe(2)
  })
})
