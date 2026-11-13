import type { GristDocApi, GristReplicaColumn, GristRowRecord } from "../types"
import { decodeGristValue } from "./grist-value-codec"

/** Column-oriented table payload (`fetchTable`, `fetchSelectedTable`): `{ id: [...], Name: [...] }`. */
export type GristColumnarTable = Record<string, unknown[]>
export type GristTableRowsOrder = "none" | "id" | "grist"
export type FetchGristTableRowsOptions = {
  /** Column metadata, to decode each cell (except `id`) with `decodeGristValue`. */
  columns?: Record<string, GristReplicaColumn>
  /**
   * Row order:
   * - `grist` (default): `manualSort` ascending when present, then `id`.
   * - `id`: numeric `id` ascending.
   * - `none`: as `fetchTable` returned them.
   */
  order?: GristTableRowsOrder
}

/** Row count from columnar `fetchTable` data (prefers `id` column length). */
export function computeRowCount(data: Record<string, unknown[]>): number {
  const idCol = data.id
  if (Array.isArray(idCol)) return idCol.length
  for (const key of Object.keys(data)) {
    const col = data[key]
    if (Array.isArray(col)) return col.length
  }
  return 0
}

/**
 * Decode columnar `fetchTable` into replica row objects (`{ id, ...cells }`, one per row).
 */
export function decodeColumnarToReplicaRows(
  data: GristColumnarTable,
  columnIds: string[],
  columns: Record<string, GristReplicaColumn>,
  maxRows?: number
): GristRowRecord[] {
  const nFull = computeRowCount(data)
  const n = maxRows !== undefined ? Math.min(nFull, maxRows) : nFull
  const out: GristRowRecord[] = []
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = {}
    for (const k of columnIds) {
      const arr = data[k]
      const raw = Array.isArray(arr) ? arr[i] : undefined
      if (k === "id") {
        row[k] = raw
      } else {
        row[k] = decodeGristValue(raw, columns[k]) as unknown
      }
    }
    out.push(row as GristRowRecord)
  }
  return out
}

/** Turn `fetchTable` output into row objects (order follows the `id` column). */
export function tableDataToRows<T = Record<string, unknown>>(
  data: GristColumnarTable
): GristRowRecord<T>[] {
  const idCol = data.id
  if (!Array.isArray(idCol) || idCol.length === 0) return []
  const keys = Object.keys(data)
  const n = idCol.length
  const rows: GristRowRecord<T>[] = []
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = {}
    for (const k of keys) {
      const col = data[k]
      row[k] = Array.isArray(col) ? col[i] : undefined
    }
    rows.push(row as GristRowRecord<T>)
  }
  return rows
}

function manualSortKey(row: Record<string, unknown>): number | null {
  const v = row.manualSort
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

/**
 * Sort rows by Grist's display order: `manualSort` ascending when present on
 * any row, otherwise numeric `id` ascending.
 */
export function sortRowsByGristOrder<T = Record<string, unknown>>(
  rows: readonly GristRowRecord<T>[]
): GristRowRecord<T>[] {
  const hasManual = rows.some((r) => manualSortKey(r as Record<string, unknown>) !== null)
  if (!hasManual) {
    return [...rows].sort((a, b) => {
      const ida = typeof a.id === "number" ? a.id : 0
      const idb = typeof b.id === "number" ? b.id : 0
      return ida - idb
    })
  }
  return [...rows].sort((a, b) => {
    const ma = manualSortKey(a as Record<string, unknown>)
    const mb = manualSortKey(b as Record<string, unknown>)
    if (ma !== null && mb !== null && ma !== mb) return ma - mb
    if (ma !== null && mb === null) return -1
    if (ma === null && mb !== null) return 1
    const ida = typeof a.id === "number" ? a.id : 0
    const idb = typeof b.id === "number" ? b.id : 0
    return ida - idb
  })
}

/**
 * Same row materialization as {@link fetchGristTableRows} after `fetchTable`
 * returns columnar data. Hosts that already have columnar data (e.g. the
 * emulator building from in-memory rows) can use this and skip `docApi.fetchTable`.
 */
export function materializeGristRowsFromColumnar<T extends Record<string, unknown> = Record<string, unknown>>(
  data: GristColumnarTable,
  options?: FetchGristTableRowsOptions
): GristRowRecord<T>[] {
  const order = options?.order ?? "grist"
  let rows: GristRowRecord<T>[]
  if (options?.columns) {
    const columnIds = Object.keys(data)
    rows = decodeColumnarToReplicaRows(data, columnIds, options.columns) as GristRowRecord<T>[]
  } else {
    rows = tableDataToRows<T>(data)
  }

  if (order === "none") return rows
  if (order === "id") {
    return [...rows].sort((a, b) => {
      const ida = typeof a.id === "number" ? a.id : 0
      const idb = typeof b.id === "number" ? b.id : 0
      return ida - idb
    })
  }
  return sortRowsByGristOrder(rows)
}

/**
 * Fetch a table and return rows as objects, optionally decoded from schema and sorted.
 */
export async function fetchGristTableRows<T extends Record<string, unknown> = Record<string, unknown>>(
  docApi: GristDocApi,
  tableId: string,
  options?: FetchGristTableRowsOptions
): Promise<GristRowRecord<T>[]> {
  const data = (await docApi.fetchTable(tableId)) as GristColumnarTable
  return materializeGristRowsFromColumnar<T>(data, options)
}
