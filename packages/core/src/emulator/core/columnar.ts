/**
 * Helpers to project an {@link EmulatorTable}'s row-array storage into Grist's
 * columnar wire format expected by `fetchTable` / `fetchSelectedTable`:
 *
 *   { id: number[], colA: unknown[], colB: unknown[], ... }
 *
 * When `keepEncoded` is `false` (Grist's default for the view API), values
 * are decoded as the plugin API decodes them: a list `["L", ...]` arrives as
 * its items. When `keepEncoded` is `true`, Date columns are emitted in tuple
 * form (`["d", epoch]`) and lists keep their tag. `raw` is `docApi.fetchTable`'s
 * form: what Grist stores, lists tagged and dates in seconds.
 */

import type { GristRowRecord } from "../../sdk/types"
import type { EmulatorTable } from "./types"

export type ColumnarTable = Record<string, unknown[]>

/**
 * A formula error as the plugin API decodes `["E", name, message, details]`
 * (grist-plugin-api.js's own `RaisedException`, same name and fields): what
 * a widget reads with keepEncoded off (#135).
 */
class RaisedException {
  name: string
  message?: string
  details?: string
  user_input?: unknown
  constructor(args: unknown[]) {
    this.name = String(args[0])
    this.message = typeof args[1] === "string" ? args[1] : undefined
    this.details = typeof args[2] === "string" ? args[2] : undefined
    const input = args[3]
    this.user_input = input && typeof input === "object" ? (input as { u?: unknown }).u : undefined
  }
  /** As Grist shows it, e.g. "#DIV/0!". */
  toString(): string {
    switch (this.name) {
      case "ZeroDivisionError":
        return "#DIV/0!"
      case "UnmarshallableError":
        return this.details || `#${this.name}`
      case "InvalidTypedValue":
        return `#Invalid ${this.message}: ${this.details}`
    }
    return `#${this.name}`
  }
}

export type ToColumnarOptions = {
  keepEncoded?: boolean
  /**
   * Grist's stored form, as `docApi.fetchTable` returns it: lists stay
   * `["L", ...]`, dates are seconds. Without it, a read as the view API
   * gives it (`fetchSelectedTable`, `onRecords`): lists decoded unless
   * `keepEncoded`.
   */
  raw?: boolean
}

export function rowsToColumnar(
  table: EmulatorTable,
  rows: readonly GristRowRecord[],
  options: ToColumnarOptions = {}
): ColumnarTable {
  const cols = Object.keys(table.columns)
  const out: ColumnarTable = { id: rows.map((r) => r.id) }
  for (const col of cols) {
    out[col] = rows.map((r) => encodeForWire(r[col], table.columns[col]?.type, options.keepEncoded, options.raw))
  }
  return out
}

export function rowToRecord(
  table: EmulatorTable,
  row: GristRowRecord,
  options: ToColumnarOptions = {}
): Record<string, unknown> {
  const out: Record<string, unknown> = { id: row.id }
  for (const col of Object.keys(table.columns)) {
    out[col] = encodeForWire(row[col], table.columns[col]?.type, options.keepEncoded, options.raw)
  }
  return out
}

export function encodeForWire(value: unknown, type: string | undefined, keepEncoded: boolean | undefined, raw?: boolean): unknown {
  if (value instanceof Date) {
    const epoch = Math.floor(value.getTime() / 1000)
    if (keepEncoded && !raw) {
      return type && type.startsWith("DateTime") ? ["D", epoch, "UTC"] : ["d", epoch]
    }
    return epoch
  }
  // Grist decodes a stored list with keepEncoded off: ["L", "a"] arrives as
  // ["a"], so a first choice "L" is a choice (#133).
  if (!keepEncoded && !raw && Array.isArray(value)) {
    if (value[0] === "L") return value.slice(1)
    if (value[0] === "E" && value.length > 1) return new RaisedException(value.slice(1))
  }
  return value
}
