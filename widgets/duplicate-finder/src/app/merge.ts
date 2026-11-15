import type { GristColumnInfo, GristUserActionTuple } from "grist-widget-sdk"
import { gristBulkRemoveRecordAction, gristBulkUpdateRecordAction } from "grist-widget-sdk/actions"

import { isBlank } from "./match"

/** What a merge and the report read from Grist. */
export type Reader = {
  listTables: () => Promise<string[]>
  listColumns: (tableId: string) => Promise<GristColumnInfo[]>
  fetchRows: (tableId: string) => Promise<Record<string, unknown>[]>
}

export type Plan = {
  keep: number
  remove: number[]
  /** Blank cells of the kept row filled from the others. */
  filled: number
  /** References moved from a deleted row to the kept one, per table. */
  moved: { tableId: string; count: number }[]
  actions: GristUserActionTuple[]
}

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [])
/** A cell Grist couldn't compute: `["E", ...]`. */
export const isError = (v: unknown) => Array.isArray(v) && v[0] === "E"

/**
 * One merge of `remove` into `keep`, as one list of actions (one undo in
 * Grist): the kept row's blank data cells filled from the others in
 * order, every Ref and RefList to a deleted row pointed at the kept one,
 * in every table, then the deleted rows removed.
 */
export async function planMerge(api: Reader, tableId: string, keep: number, remove: number[]): Promise<Plan> {
  const gone = new Set(remove)
  const actions: GristUserActionTuple[] = []
  const tables = await api.listTables()
  const cache = new Map<string, Record<string, unknown>[]>()
  const rowsOf = async (t: string) => cache.get(t) ?? (cache.set(t, await api.fetchRows(t)), cache.get(t)!)

  // The kept row's blank cells, from the first deleted row that has one.
  const own = await rowsOf(tableId)
  const byId = new Map(own.map((r) => [r.id as number, r]))
  const kept = byId.get(keep)
  const fill: Record<string, unknown> = {}
  for (const col of await api.listColumns(tableId)) {
    if (col.isFormula || !kept || !isBlank(kept[col.colId])) continue
    const from = remove.map((id) => byId.get(id)?.[col.colId]).find((v) => !isBlank(v) && !isError(v))
    if (from !== undefined) fill[col.colId] = from
  }
  if (kept && Object.keys(fill).length) {
    Object.assign(kept, fill)
    actions.push(gristBulkUpdateRecordAction(tableId, [keep], Object.fromEntries(Object.entries(fill).map(([c, v]) => [c, [v]]))))
  }

  // References to a deleted row, in any table, moved to the kept row.
  const moved: Plan["moved"] = []
  for (const t of tables) {
    const refCols = (await api.listColumns(t)).filter((c) => !c.isFormula && (c.type === `Ref:${tableId}` || c.type === `RefList:${tableId}`))
    if (!refCols.length) continue
    let count = 0
    for (const col of refCols) {
      const list = col.type!.startsWith("RefList:")
      const rowIds: number[] = []
      const values: unknown[] = []
      for (const row of await rowsOf(t)) {
        if (t === tableId && gone.has(row.id as number)) continue
        const v = row[col.colId]
        if (list) {
          const before = ids(v)
          if (!before.some((id) => gone.has(id))) continue
          const after = [...new Set(before.map((id) => (gone.has(id) ? keep : id)))]
          rowIds.push(row.id as number)
          values.push(["L", ...after])
          count += before.filter((id) => gone.has(id)).length
        } else if (typeof v === "number" && gone.has(v)) {
          rowIds.push(row.id as number)
          values.push(keep)
          count++
        }
      }
      if (rowIds.length) actions.push(gristBulkUpdateRecordAction(t, rowIds, { [col.colId]: values }))
    }
    if (count) moved.push({ tableId: t, count })
  }

  actions.push(gristBulkRemoveRecordAction(tableId, remove))
  return { keep, remove, filled: Object.keys(fill).length, moved, actions }
}

export type ColumnReport = { colId: string; label: string; type: string; blank: number; wrongType: number; errors: number; broken: number | null }

/** Whether a stored value fits its column's type (Any and Text-like take anything). */
function fits(type: string, v: unknown): boolean {
  const base = type.split(":")[0]
  switch (base) {
    case "Numeric":
    case "Int":
    case "Date":
    case "DateTime":
    case "Ref":
    case "ManualSortPos":
      return typeof v === "number"
    case "Bool":
      return typeof v === "boolean"
    case "ChoiceList":
    case "RefList":
    case "Attachments":
      return Array.isArray(v)
    case "Choice":
    case "Text":
      return typeof v === "string"
    default:
      return true
  }
}

/**
 * Each column's blank cells, cells that don't fit its type, formula errors,
 * and, for a Ref or RefList column, references to rows that don't exist.
 */
export async function columnReport(api: Reader, tableId: string): Promise<ColumnReport[]> {
  const [columns, rows] = await Promise.all([api.listColumns(tableId), api.fetchRows(tableId)])
  const refIds = new Map<string, Set<number>>()
  for (const col of columns) {
    const m = /^Ref(?:List)?:(.+)$/.exec(col.type ?? "")
    if (m && !refIds.has(m[1]!)) refIds.set(m[1]!, new Set((await api.fetchRows(m[1]!)).map((r) => r.id as number)))
  }
  return columns.map((col) => {
    const type = col.type ?? "Any"
    const target = /^Ref(?:List)?:(.+)$/.exec(type)?.[1]
    const exists = target ? refIds.get(target) : undefined
    let blank = 0
    let wrongType = 0
    let errors = 0
    let broken = 0
    for (const row of rows) {
      const v = row[col.colId]
      if (isError(v)) errors++
      else if (isBlank(v) || (type.startsWith("Ref:") && v === 0)) blank++
      else if (!fits(type, v)) wrongType++
      else if (exists) broken += (typeof v === "number" ? [v] : ids(v)).filter((id) => id > 0 && !exists.has(id)).length
    }
    return { colId: col.colId, label: col.label || col.colId, type, blank, wrongType, errors, broken: exists ? broken : null }
  })
}
