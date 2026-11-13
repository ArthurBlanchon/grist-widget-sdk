/**
 * Pure action engine: applies Grist user actions to an
 * {@link EmulatorDocumentState} and emits the resulting events on the bus.
 *
 * This is the single place where state mutates. Every API impl ultimately
 * routes through `applyUserActions` so behaviour is consistent regardless of
 * the surface (`grist.docApi.applyUserActions`, `selectedTable.create`,
 * `setCursorPos`, etc.).
 *
 * Supported user actions:
 *   - AddRecord, BulkAddRecord
 *   - UpdateRecord, BulkUpdateRecord
 *   - RemoveRecord, BulkRemoveRecord
 *   - AddColumn, RemoveColumn, RenameColumn, ModifyColumn
 *   - AddTable, RemoveTable, RenameTable
 *
 * Unknown actions throw a structured error instead of silently succeeding,
 * which surfaces protocol gaps loudly during widget development.
 */

import { coerceGristDocApiRefRowId } from "../../sdk/helpers/grist-value-codec"
import {
  evaluateRowFormulas,
  findRow,
  findRowIndex,
  getTable,
  nextRowId,
  syncRefListDisplayHelpers,
} from "./document"
import type { EventBus } from "./event-bus"
import type { EmulatorColumn, EmulatorDocumentState, EmulatorTable } from "./types"

export class EmulatorActionError extends Error {
  constructor(
    public readonly action: unknown,
    message: string
  ) {
    super(message)
    this.name = "EmulatorActionError"
  }
}

export type ApplyUserActionResult = {
  /** Result mirroring Grist's `applyUserActions`: per-action retValues. */
  retValues: unknown[]
  /** Tables that received row-level changes (de-duped). */
  changedTableIds: string[]
}

export function applyUserActions(
  state: EmulatorDocumentState,
  bus: EventBus,
  actions: unknown[][]
): ApplyUserActionResult {
  const retValues: unknown[] = []
  const changed = new Set<string>()

  for (const action of actions) {
    bus.emit({ type: "user-action", action })
    const ret = applySingle(state, action, changed)
    retValues.push(ret)
  }

  for (const tableId of changed) {
    bus.emit({ type: "data-change", tableId })
  }

  return { retValues, changedTableIds: [...changed] }
}

function applySingle(
  state: EmulatorDocumentState,
  action: unknown[],
  changed: Set<string>
): unknown {
  const [name, ...args] = action
  switch (name) {
    case "AddRecord":
      return addRecord(state, args, changed)
    case "BulkAddRecord":
      return bulkAddRecord(state, args, changed)
    case "UpdateRecord":
      return updateRecord(state, args, changed)
    case "BulkUpdateRecord":
      return bulkUpdateRecord(state, args, changed)
    case "RemoveRecord":
      return removeRecord(state, args, changed)
    case "BulkRemoveRecord":
      return bulkRemoveRecord(state, args, changed)
    case "AddColumn":
      return addColumn(state, args)
    case "AddVisibleColumn":
      // The emulator has no concept of section view fields, so the "visible"
      // part of `AddVisibleColumn` is a no-op here. We still create the
      // column so widgets that issue this user action (the higher-level form
      // recommended by Grist for "add a column to the active view") work
      // identically against the emulator.
      return addColumn(state, args)
    case "RemoveColumn":
      return removeColumn(state, args, changed)
    case "RenameColumn":
      return renameColumn(state, args, changed)
    case "ModifyColumn":
      return modifyColumn(state, args, changed)
    case "AddTable":
      return addTable(state, args)
    case "RemoveTable":
      return removeTable(state, args)
    case "RenameTable":
      return renameTable(state, args)
    default:
      throw new EmulatorActionError(action, `Unsupported user action: ${String(name)}`)
  }
}

// ---------- row ops ----------

function addRecord(
  state: EmulatorDocumentState,
  [tableId, rowId, values]: unknown[],
  changed: Set<string>
): number {
  const table = getTable(state, requireString(tableId, "AddRecord.tableId"))
  const id = typeof rowId === "number" ? rowId : nextRowId(table)
  const normalizedValues = normalizeValuesForTable(
    table,
    (values as Record<string, unknown>) ?? {}
  )
  const row = { id, ...normalizedValues }
  ensureColumns(table, normalizedValues)
  evaluateRowFormulas(state, table, row)
  syncRefListDisplayHelpers(state, table, row)
  table.rows.push(row)
  changed.add(table.tableId)
  return id
}

function bulkAddRecord(
  state: EmulatorDocumentState,
  [tableId, rowIds, columnar]: unknown[],
  changed: Set<string>
): number[] {
  const table = getTable(state, requireString(tableId, "BulkAddRecord.tableId"))
  const cols = normalizeColumnarForTable(
    table,
    (columnar as Record<string, unknown[]>) ?? {}
  )
  const ids = Array.isArray(rowIds) ? rowIds : []
  const length = ids.length || lengthOf(cols)
  const out: number[] = []
  ensureColumns(table, cols, true)
  for (let i = 0; i < length; i++) {
    const id = typeof ids[i] === "number" ? (ids[i] as number) : nextRowId(table)
    const row: Record<string, unknown> & { id: number } = { id }
    for (const colId of Object.keys(cols)) row[colId] = cols[colId][i]
    evaluateRowFormulas(state, table, row)
    syncRefListDisplayHelpers(state, table, row)
    table.rows.push(row)
    out.push(id)
  }
  changed.add(table.tableId)
  return out
}

function updateRecord(
  state: EmulatorDocumentState,
  [tableId, rowId, values]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "UpdateRecord.tableId"))
  const id = requireNumber(rowId, "UpdateRecord.rowId")
  const row = findRow(table, id)
  if (!row) throw new EmulatorActionError(["UpdateRecord", tableId, rowId, values], `Row ${id} not found in ${table.tableId}`)
  const normalizedValues = normalizeValuesForTable(
    table,
    (values as Record<string, unknown>) ?? {}
  )
  ensureColumns(table, normalizedValues)
  Object.assign(row, normalizedValues)
  evaluateRowFormulas(state, table, row)
  syncRefListDisplayHelpers(state, table, row)
  changed.add(table.tableId)
  return null
}

function bulkUpdateRecord(
  state: EmulatorDocumentState,
  [tableId, rowIds, columnar]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "BulkUpdateRecord.tableId"))
  const ids = rowIds as number[]
  const cols = normalizeColumnarForTable(
    table,
    (columnar as Record<string, unknown[]>) ?? {}
  )
  ensureColumns(table, cols, true)
  ids.forEach((id, idx) => {
    const row = findRow(table, id)
    if (!row) throw new EmulatorActionError(["BulkUpdateRecord", tableId, ids, cols], `Row ${id} not found in ${table.tableId}`)
    for (const colId of Object.keys(cols)) row[colId] = cols[colId][idx]
    evaluateRowFormulas(state, table, row)
    syncRefListDisplayHelpers(state, table, row)
  })
  changed.add(table.tableId)
  return null
}

function removeRecord(
  state: EmulatorDocumentState,
  [tableId, rowId]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "RemoveRecord.tableId"))
  const id = requireNumber(rowId, "RemoveRecord.rowId")
  const idx = findRowIndex(table, id)
  if (idx >= 0) table.rows.splice(idx, 1)
  if (state.selection.tableId === table.tableId && state.selection.rowId === id) {
    state.selection.rowId = table.rows[0]?.id ?? null
  }
  changed.add(table.tableId)
  return null
}

function bulkRemoveRecord(
  state: EmulatorDocumentState,
  [tableId, rowIds]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "BulkRemoveRecord.tableId"))
  const ids = new Set(rowIds as number[])
  table.rows = table.rows.filter((r) => !ids.has(r.id))
  if (state.selection.tableId === table.tableId && typeof state.selection.rowId === "number" && ids.has(state.selection.rowId)) {
    state.selection.rowId = table.rows[0]?.id ?? null
  }
  changed.add(table.tableId)
  return null
}

// ---------- column ops ----------

function addColumn(
  state: EmulatorDocumentState,
  [tableId, colId, info]: unknown[]
): null {
  const table = getTable(state, requireString(tableId, "AddColumn.tableId"))
  const col = requireString(colId, "AddColumn.colId")
  if (table.columns[col]) throw new EmulatorActionError(["AddColumn", tableId, colId], `Column ${col} already exists`)
  table.columns[col] = (info as EmulatorColumn) ?? {}
  for (const row of table.rows) {
    if (!(col in row)) row[col] = null
  }
  return null
}

function removeColumn(
  state: EmulatorDocumentState,
  [tableId, colId]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "RemoveColumn.tableId"))
  const col = requireString(colId, "RemoveColumn.colId")
  delete table.columns[col]
  for (const row of table.rows) delete row[col]
  changed.add(table.tableId)
  return null
}

function renameColumn(
  state: EmulatorDocumentState,
  [tableId, colId, newColId]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "RenameColumn.tableId"))
  const from = requireString(colId, "RenameColumn.colId")
  const to = requireString(newColId, "RenameColumn.newColId")
  if (!table.columns[from]) throw new EmulatorActionError(["RenameColumn", tableId, from, to], `Column ${from} not found`)
  if (from === to) return null
  table.columns[to] = table.columns[from]
  delete table.columns[from]
  for (const row of table.rows) {
    if (from in row) {
      row[to] = row[from]
      delete row[from]
    }
  }
  changed.add(table.tableId)
  return null
}

function modifyColumn(
  state: EmulatorDocumentState,
  [tableId, colId, info]: unknown[],
  changed: Set<string>
): null {
  const table = getTable(state, requireString(tableId, "ModifyColumn.tableId"))
  const col = requireString(colId, "ModifyColumn.colId")
  if (!table.columns[col]) throw new EmulatorActionError(["ModifyColumn", tableId, colId], `Column ${col} not found`)
  table.columns[col] = { ...table.columns[col], ...(info as EmulatorColumn) }
  changed.add(table.tableId)
  return null
}

// ---------- table ops ----------

function addTable(state: EmulatorDocumentState, [tableId, columns]: unknown[]): string {
  const id = requireString(tableId, "AddTable.tableId")
  if (state.tables.has(id)) throw new EmulatorActionError(["AddTable", tableId], `Table ${id} already exists`)
  const cols: Record<string, EmulatorColumn> = {}
  for (const c of (columns as Array<{ id: string } & EmulatorColumn>) ?? []) {
    cols[c.id] = { ...c }
  }
  state.tables.set(id, { tableId: id, columns: cols, rows: [] })
  return id
}

function removeTable(state: EmulatorDocumentState, [tableId]: unknown[]): null {
  const id = requireString(tableId, "RemoveTable.tableId")
  state.tables.delete(id)
  if (state.selection.tableId === id) {
    const fallback = state.tables.keys().next().value as string | undefined
    if (fallback) {
      state.selection.tableId = fallback
      state.selection.rowId = null
    }
  }
  return null
}

function renameTable(state: EmulatorDocumentState, [from, to]: unknown[]): null {
  const fromId = requireString(from, "RenameTable.from")
  const toId = requireString(to, "RenameTable.to")
  const table = state.tables.get(fromId)
  if (!table) throw new EmulatorActionError(["RenameTable", fromId], `Table ${fromId} not found`)
  state.tables.delete(fromId)
  table.tableId = toId
  state.tables.set(toId, table)
  if (state.selection.tableId === fromId) state.selection.tableId = toId
  return null
}

// ---------- helpers ----------

function ensureColumns(
  table: EmulatorTable,
  values: Record<string, unknown> | Record<string, unknown[]>,
  bulk = false
): void {
  for (const col of Object.keys(values)) {
    if (!table.columns[col]) {
      const sample = bulk ? (values as Record<string, unknown[]>)[col]?.[0] : (values as Record<string, unknown>)[col]
      table.columns[col] = inferType(sample)
    }
  }
}

function inferType(sample: unknown): EmulatorColumn {
  switch (typeof sample) {
    case "number":
      return { type: "Numeric" }
    case "boolean":
      return { type: "Bool" }
    case "string":
      return { type: "Text" }
    default:
      return { type: "Any" }
  }
}

function lengthOf(cols: Record<string, unknown[]>): number {
  for (const arr of Object.values(cols)) if (Array.isArray(arr)) return arr.length
  return 0
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`Expected non-empty string for ${name}`)
  return value
}

function requireNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`Expected number for ${name}`)
  return value
}

function normalizeValuesForTable(
  table: EmulatorTable,
  values: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [colId, value] of Object.entries(values)) {
    out[colId] = normalizeCellValueForType(value, table.columns[colId]?.type)
  }
  return out
}

function normalizeColumnarForTable(
  table: EmulatorTable,
  columns: Record<string, unknown[]>
): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}
  for (const [colId, values] of Object.entries(columns)) {
    const type = table.columns[colId]?.type
    out[colId] = Array.isArray(values)
      ? values.map((value) => normalizeCellValueForType(value, type))
      : []
  }
  return out
}

function normalizeCellValueForType(value: unknown, type: string | undefined): unknown {
  if (value === null || value === undefined || typeof type !== "string") return value

  // As Grist does (checked in 1.7.22): a list column takes `["L", ...]`; a
  // bare array written to it is stored as an error cell, not as the list.
  if (isListColumnType(type) && Array.isArray(value) && value[0] !== "L") return ["E", "KeyError"]
  if (type.startsWith("Ref:")) return normalizeRefValue(value)
  if (type.startsWith("RefList:")) return normalizeRefListValue(value)
  return value
}

/**
 * Canonical ref row id for emulator storage (`Ref:*` columns).
 * Accepts bare ids, `"12"`, Grist tuples `["r", id]` / `["R", tableId, id]`,
 * and detailed-ref shapes `{ rowId }` (decoded `Reference` values, grid edits).
 */
function extractRefRowId(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (value && typeof value === "object" && "__ref" in value) {
    const inner = (value as { rowId?: unknown }).rowId
    return extractRefRowId(inner)
  }
  if (value && typeof value === "object" && "rowId" in value) {
    return extractRefRowId((value as { rowId: unknown }).rowId)
  }
  const fromTuple = coerceGristDocApiRefRowId(value)
  if (fromTuple !== undefined && fromTuple > 0) return Math.trunc(fromTuple)
  return toPositiveInt(value)
}

function isListColumnType(type: string): boolean {
  return type === "ChoiceList" || type === "Attachments" || type.startsWith("RefList:")
}

function normalizeRefValue(value: unknown): number | null {
  return extractRefRowId(value)
}

function normalizeRefListValue(value: unknown): unknown[] {
  const toIdList = (items: unknown[]): number[] =>
    Array.from(
      new Set(items.map((item) => extractRefRowId(item)).filter((item): item is number => item !== null))
    )

  // Grist tuple form: ["L", ...ids]
  if (Array.isArray(value) && value[0] === "L") {
    return ["L", ...toIdList(value.slice(1))]
  }
  if (Array.isArray(value)) {
    return ["L", ...toIdList(value)]
  }
  if (typeof value === "string") {
    const tokens = value.split(",").map((t) => t.trim()).filter(Boolean)
    return ["L", ...toIdList(tokens)]
  }
  if (value && typeof value === "object" && Array.isArray((value as { rowIds?: unknown }).rowIds)) {
    return ["L", ...toIdList((value as { rowIds: unknown[] }).rowIds)]
  }
  return ["L"]
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.trunc(value)
  if (typeof value === "string") {
    const n = Number.parseInt(value.trim(), 10)
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}
