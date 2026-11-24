/**
 * Property-based tests (fast-check) of the SDK's pure functions that read
 * what Grist sends: whatever value a cell, an option or a message holds,
 * they return a result and never throw, and the encoders are the inverse
 * of the decoders where the SDK promises it.
 *
 * OpenSSF Scorecard counts these as fuzzing (its Fuzzing check).
 */
import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { coerceGristDocApiRefRowId, decodeGristValue, encodeGristValue } from "../../src/sdk/helpers/grist-value-codec"
import { parseGristWidgetOptionsCell } from "../../src/sdk/helpers/grist-widget-options"
import { parseGristThemePayload } from "../../src/sdk/helpers/grist-theme-payload"
import { encodeGristCell } from "../../src/sdk/runtime/cells"
import { stableJson } from "../../src/sdk/runtime/runtime"

const COLUMN_TYPES = ["Text", "Numeric", "Int", "Bool", "Date", "DateTime:Europe/Paris", "Ref:People", "RefList:People", "ChoiceList", "Attachments", "Any"]
const columnType = fc.option(fc.constantFrom(...COLUMN_TYPES), { nil: undefined })
/** A Grist marshalled tuple with any payload: `["L", ...]`, `["D", ...]`, `["E", ...]`... */
const tuple = fc.tuple(fc.constantFrom("E", "L", "D", "d", "R", "r", "P"), fc.array(fc.anything(), { maxLength: 4 })).map(([tag, rest]) => [tag, ...rest])
const cell = fc.oneof(fc.anything(), tuple)
/** Valid dates on whole seconds, within what Grist stores. */
const date = fc.date({ min: new Date("1900-01-01T00:00:00Z"), max: new Date("2200-01-01T00:00:00Z"), noInvalidDate: true }).map((d) => new Date(Math.floor(d.getTime() / 1000) * 1000))
const rowId = fc.integer({ min: 1, max: 2 ** 31 - 1 })

describe("reading what Grist sends never throws", () => {
  it("decodeGristValue, for any cell and column type", () => {
    fc.assert(fc.property(cell, columnType, (value, type) => {
      decodeGristValue(value, type ? { id: "c", type } : undefined)
    }))
  })

  it("coerceGristDocApiRefRowId returns a finite number or undefined", () => {
    fc.assert(fc.property(cell, (value) => {
      const id = coerceGristDocApiRefRowId(value)
      expect(id === undefined || Number.isFinite(id)).toBe(true)
    }))
  })

  it("parseGristWidgetOptionsCell returns a plain object or undefined, for any value or string", () => {
    fc.assert(fc.property(fc.oneof(fc.anything(), fc.string(), fc.json()), (raw) => {
      const parsed = parseGristWidgetOptionsCell(raw)
      expect(parsed === undefined || (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed))).toBe(true)
    }))
  })

  it("parseGristThemePayload returns light, dark or null", () => {
    const payload = fc.oneof(fc.anything(), fc.record({ theme: fc.oneof(fc.anything(), fc.record({ appearance: fc.anything() })) }))
    fc.assert(fc.property(payload, (p) => {
      expect([null, "light", "dark"]).toContain(parseGristThemePayload(p))
    }))
  })
})

describe("encoding is the inverse of decoding", () => {
  it("a Date written to a Date or DateTime column reads back as the same instant", () => {
    fc.assert(fc.property(date, fc.constantFrom("Date", "DateTime:UTC"), (d, type) => {
      const column = { id: "c", type }
      expect(decodeGristValue(encodeGristValue(d, column), column)).toEqual(d)
      expect(decodeGristValue(encodeGristCell(type, d), column)).toEqual(d)
    }))
  })

  it("a row id written to a Ref column reads back as that row", () => {
    fc.assert(fc.property(rowId, (id) => {
      const column = { id: "c", type: "Ref:People" }
      expect(decodeGristValue(encodeGristValue({ rowId: id }, column), column)).toEqual({ __ref: true, rowId: id })
    }))
  })

  it("a list written to a ChoiceList or RefList column is one `[\"L\", ...]` that reads back as the list", () => {
    const list = fc.oneof(
      // A first choice "L" is read as the list tag and lost: issue #133. Left
      // out until that is decided, so this property doesn't fail at random.
      fc.tuple(fc.constant("ChoiceList"), fc.array(fc.string(), { maxLength: 8 }).filter((items) => items[0] !== "L")),
      fc.tuple(fc.constant("RefList:People"), fc.array(rowId, { maxLength: 8 }))
    )
    fc.assert(fc.property(list, ([type, items]) => {
      const encoded = encodeGristCell(type, items)
      expect(encoded).toEqual(["L", ...items])
      // Safe to call twice: an encoded list passes through.
      expect(encodeGristCell(type, encoded)).toEqual(encoded)
      expect(decodeGristValue(encoded, { id: "c", type })).toEqual(items)
    }))
  })
})

describe("stableJson", () => {
  it("is the same with an object's keys in reverse order, and parses back to the value", () => {
    fc.assert(fc.property(fc.jsonValue(), (value) => {
      const shuffled = JSON.parse(JSON.stringify(value), (_k, v: unknown) =>
        v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v
      ) as unknown
      expect(stableJson(shuffled)).toBe(stableJson(value))
      expect(JSON.parse(stableJson(value))).toEqual(JSON.parse(JSON.stringify(value)))
    }))
  })
})
