/**
 * Helpers to project an {@link EmulatorTable}'s row-array storage into Grist's
 * columnar wire format expected by `fetchTable` / `fetchSelectedTable`:
 *
 *   { id: number[], colA: unknown[], colB: unknown[], ... }
 *
 * When `keepEncoded` is `false` (Grist's default for these APIs), values are
 * passed through as-is — JS-native primitives (string / number / boolean /
 * Date / arrays) are valid Grist plugin values. When `keepEncoded` is `true`,
 * Date columns are emitted in tuple form (`["d", epoch]`) so callers can
 * round-trip them.
 */

import type { GristRowRecord } from "../../sdk/types"
import type { EmulatorTable } from "./types"

export type ColumnarTable = Record<string, unknown[]>

export type ToColumnarOptions = {
  keepEncoded?: boolean
}

export function rowsToColumnar(
  table: EmulatorTable,
  rows: readonly GristRowRecord[],
  options: ToColumnarOptions = {}
): ColumnarTable {
  const cols = Object.keys(table.columns)
  const out: ColumnarTable = { id: rows.map((r) => r.id) }
  for (const col of cols) {
    out[col] = rows.map((r) => encodeForWire(r[col], table.columns[col]?.type, options.keepEncoded))
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
    out[col] = encodeForWire(row[col], table.columns[col]?.type, options.keepEncoded)
  }
  return out
}

function encodeForWire(value: unknown, type: string | undefined, keepEncoded: boolean | undefined): unknown {
  if (value instanceof Date) {
    const epoch = Math.floor(value.getTime() / 1000)
    if (keepEncoded) {
      return type && type.startsWith("DateTime") ? ["D", epoch, "UTC"] : ["d", epoch]
    }
    return epoch
  }
  return value
}
