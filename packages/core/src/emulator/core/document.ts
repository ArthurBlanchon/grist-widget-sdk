import { inferDisplayHelpersByRef } from "./display-helpers"
import { normalizeReplicaDocumentInput } from "../../sdk/helpers/replica-normalize"
import { coerceGristDocApiRefRowId } from "../../sdk/helpers/grist-value-codec"
import type { GristReplicaDocument, GristReplicaTable } from "../../sdk/replica-document"
import type { GristRowRecord } from "../../sdk/types"
import type { EmulatorColumn, EmulatorDocumentState, EmulatorTable } from "./types"

const SYSTEM_COLUMN = "id"

const EMULATOR_JS_FORMULA_PLACEHOLDER = "(emulator JavaScript formula)"

/** Replica table for {@link createDocument}; columns may include `formulaFn` / `inferredFormula` (emulator-only). */
export type CreateDocumentTableInput = Omit<GristReplicaTable, "columns"> & {
  columns?: Record<string, EmulatorColumn>
}

/** Replica document for {@link createDocument}; widens table columns to {@link EmulatorColumn}. */
export type CreateDocumentInput = Omit<GristReplicaDocument, "tables"> & {
  tables: Record<string, CreateDocumentTableInput>
}

/**
 * Ensure `formula` (original) and `inferredFormula` strings exist alongside optional `formulaFn`.
 */
export function enrichEmulatorColumnMetadata(col: EmulatorColumn): EmulatorColumn {
  const originalTrimmed = col.formula?.trim() ?? ""
  const explicitInferred = col.inferredFormula?.trim() ?? ""

  if (col.formulaFn) {
    const inferredFormula =
      explicitInferred || originalTrimmed || EMULATOR_JS_FORMULA_PLACEHOLDER
    return {
      ...col,
      ...(originalTrimmed ? { formula: col.formula } : {}),
      inferredFormula,
    }
  }

  if (explicitInferred || originalTrimmed) {
    return {
      ...col,
      inferredFormula: explicitInferred || originalTrimmed || undefined,
    }
  }

  return col
}

/** Order merged column metadata for stable `fetchTable` / RDG column order. */
export function sortEmulatorColumnsByParentPos(columns: Record<string, EmulatorColumn>): Record<string, EmulatorColumn> {
  const entries = Object.entries(columns)
  entries.sort(([ka, a], [kb, b]) => {
    const pa = a.parentPos
    const pb = b.parentPos
    if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb
    if (pa !== undefined && pb === undefined) return -1
    if (pa === undefined && pb !== undefined) return 1
    return ka.localeCompare(kb)
  })
  return Object.fromEntries(entries)
}

function inferColumnsFromRows(rows: GristRowRecord[]): Record<string, EmulatorColumn> {
  const columns: Record<string, EmulatorColumn> = {}
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key === SYSTEM_COLUMN) continue
      if (!columns[key]) columns[key] = inferColumnType(row[key])
    }
  }
  return columns
}

function inferColumnType(sample: unknown): EmulatorColumn {
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

function buildTable(tableId: string, input: CreateDocumentTableInput): EmulatorTable {
  const rows = input.rows ?? []
  const inferred = inferColumnsFromRows(rows)
  const merged: Record<string, EmulatorColumn> = {}
  for (const [colId, col] of Object.entries({ ...inferred, ...(input.columns ?? {}) })) {
    merged[colId] = enrichEmulatorColumnMetadata(col)
  }
  const columns = sortEmulatorColumnsByParentPos(merged)
  return {
    tableId,
    label: input.label,
    columns,
    rows: rows.map((row) => ({ ...row })),
  }
}

/**
 * Build an immutable initial document state from a user-provided
 * {@link GristReplicaDocument}. The state is **not** frozen — the action
 * engine mutates it in place under deterministic event diffusion.
 */
export function createDocument(input: CreateDocumentInput): EmulatorDocumentState {
  if (!input.tables || Object.keys(input.tables).length === 0) {
    throw new Error("createDocument: at least one table is required")
  }

  const normalized = normalizeReplicaDocumentInput(input)

  const tables = new Map<string, EmulatorTable>()
  for (const [tableId, tableInput] of Object.entries(normalized.tables)) {
    tables.set(tableId, buildTable(tableId, tableInput))
  }

  const firstTableId = tables.keys().next().value as string
  const requestedTableId = normalized.selection?.tableId
  const selectedTableId =
    requestedTableId && tables.has(requestedTableId) ? requestedTableId : firstTableId
  const selectedTable = tables.get(selectedTableId)!
  const fallbackRowId =
    typeof selectedTable.rows[0]?.id === "number" ? selectedTable.rows[0].id : null
  const selection = {
    tableId: selectedTableId,
    rowId: normalized.selection?.rowId ?? fallbackRowId,
    mappings: normalized.selection?.mappings,
    cursor: normalized.selection?.cursor,
  } as EmulatorDocumentState["selection"]

  return {
    docName: normalized.docName ?? "Untitled emulator document",
    tables,
    selection,
    widgetOptions: { ...(normalized.widgetOptions ?? {}) },
    widgetInteraction: { ...(normalized.widgetInteraction ?? {}) },
    configuration: normalized.configuration ?? null,
    accessToken: normalized.accessToken ?? null,
  }
}

export function getTable(state: EmulatorDocumentState, tableId: string): EmulatorTable {
  const table = state.tables.get(tableId)
  if (!table) throw new Error(`Unknown table: ${tableId}`)
  return table
}

export function getSelectedTable(state: EmulatorDocumentState): EmulatorTable {
  return getTable(state, state.selection.tableId)
}

export function nextRowId(table: EmulatorTable): number {
  let max = 0
  for (const row of table.rows) {
    if (typeof row.id === "number" && row.id > max) max = row.id
  }
  return max + 1
}

export function findRow(table: EmulatorTable, rowId: number): GristRowRecord | undefined {
  return table.rows.find((r) => r.id === rowId)
}

export function findRowIndex(table: EmulatorTable, rowId: number): number {
  return table.rows.findIndex((r) => r.id === rowId)
}

/**
 * Re-evaluate every formula column for a given row in-place. Called by the
 * action engine after Add/Update operations.
 */
export function evaluateRowFormulas(
  state: EmulatorDocumentState,
  table: EmulatorTable,
  row: GristRowRecord
): void {
  for (const [colId, col] of Object.entries(table.columns)) {
    if (col.formulaFn) {
      try {
        row[colId] = col.formulaFn(row, { table, document: state })
      } catch (err) {
        row[colId] = formulaError(err)
      }
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Pull stored row ids from a `RefList` cell (`["L", ...]` or legacy shapes). */
function extractRefListIdsFromWire(raw: unknown): number[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const items = raw[0] === "L" ? raw.slice(1) : raw
  const out: number[] = []
  for (const item of items) {
    if (typeof item === "number" && Number.isFinite(item) && item > 0) {
      out.push(Math.trunc(item))
      continue
    }
    if (item && typeof item === "object" && "rowId" in item) {
      const r = (item as { rowId: unknown }).rowId
      if (typeof r === "number" && Number.isFinite(r) && r > 0) {
        out.push(Math.trunc(r))
        continue
      }
    }
    const t = coerceGristDocApiRefRowId(item)
    if (t !== undefined && t > 0) out.push(Math.trunc(t))
  }
  return Array.from(new Set(out))
}

function fieldFromRefListHelperFormula(formula: string | undefined, refColId: string): string | null {
  if (!formula) return null
  const re = new RegExp(`\\$${escapeRegExp(refColId)}\\.([A-Za-z_]\\w*)`)
  const m = formula.match(re)
  return m?.[1] ?? null
}

function firstTextLikeColumnId(columns: Record<string, EmulatorColumn>): string | null {
  let best: { id: string; pos: number } | null = null
  for (const [colId, col] of Object.entries(columns)) {
    if (colId === "id" || colId.startsWith("gristHelper_")) continue
    const t = col.type
    if (t !== "Text" && t !== "Choice") continue
    const pos = col.parentPos ?? 99999
    if (!best || pos < best.pos) best = { id: colId, pos }
  }
  return best?.id ?? null
}

function formatLabelFromCell(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value) && value[0] === "E") return ""
  if (typeof value === "object" && value && "__ref" in value) {
    const r = (value as { rowId?: unknown }).rowId
    return typeof r === "number" && Number.isFinite(r) ? String(r) : ""
  }
  return ""
}

/**
 * Keep `gristHelper_*` display columns aligned with `RefList:*` ids after writes.
 *
 * Real Grist evaluates helper formulas (`$multiref.Nom`); replica JSON only
 * carries the formula string (no `formulaFn`), so helpers would stay stale and
 * a widget reading them would see empty labels.
 *
 * Skips helpers that define `formulaFn` so custom JS formulas keep ownership.
 */
export function syncRefListDisplayHelpers(
  state: EmulatorDocumentState,
  table: EmulatorTable,
  row: GristRowRecord
): void {
  const displayHelpersByRef = inferDisplayHelpersByRef(table.columns)
  for (const [colId, col] of Object.entries(table.columns)) {
    const type = col.type
    if (typeof type !== "string" || !type.startsWith("RefList:")) continue
    const helperColId = displayHelpersByRef[colId]
    if (!helperColId) continue
    const helperMeta = table.columns[helperColId]
    if (!helperMeta || helperMeta.formulaFn) continue

    const targetTableId = type.slice("RefList:".length)
    const targetTable = state.tables.get(targetTableId)
    if (!targetTable) continue

    const ids = extractRefListIdsFromWire(row[colId])
    if (ids.length === 0) {
      row[helperColId] = []
      continue
    }

    const fieldId =
      fieldFromRefListHelperFormula(helperMeta.formula, colId) ??
      firstTextLikeColumnId(targetTable.columns)

    const labels = ids.map((rid) => {
      if (!fieldId) return String(rid)
      const trow = findRow(targetTable, rid)
      if (!trow) return String(rid)
      const lbl = formatLabelFromCell(trow[fieldId])
      return lbl !== "" ? lbl : String(rid)
    })
    row[helperColId] = labels
  }
}

function formulaError(err: unknown): unknown {
  // Match Grist's encoded error format: ["E", code, message]
  const message = err instanceof Error ? err.message : String(err)
  return ["E", "Error", message]
}

/**
 * Synthesise `_grist_Tables` metadata from the emulator's in-memory tables.
 * Returns Grist's columnar wire shape.
 */
export function synthesizeTablesMeta(state: EmulatorDocumentState): Record<string, unknown[]> {
  const ids: number[] = []
  const tableIds: string[] = []
  const labels: (string | null)[] = []

  let nextId = 1
  for (const [tableId, table] of state.tables.entries()) {
    ids.push(nextId)
    tableIds.push(tableId)
    labels.push(table.label ?? null)
    nextId += 1
  }

  return {
    id: ids,
    tableId: tableIds,
    // Optional human-readable label; real Grist keeps more fields, but these
    // are sufficient for `buildReplicaDocumentFromDocApi` to resolve table ids.
    label: labels,
  }
}

/**
 * Synthesise `_grist_Tables_column` metadata from emulator tables/columns.
 * Mirrors the subset of fields consumed by `buildReplicaDocumentFromDocApi`.
 */
export function synthesizeTablesColumnMeta(state: EmulatorDocumentState): Record<string, unknown[]> {
  const parentIds: number[] = []
  const colIds: string[] = []
  const columnIds: number[] = []
  const types: (string | null)[] = []
  const labels: (string | null)[] = []
  const parentPos: (number | null)[] = []
  const isFormula: boolean[] = []
  const formulas: (string | null)[] = []
  const descriptions: (string | null)[] = []
  const widgetOptions: unknown[] = []
  const displayCol: (number | null)[] = []
  const visibleCol: (number | null)[] = []

  // Mirror the synthetic table ids from `synthesizeTablesMeta`.
  const tableIdToInternalId = new Map<string, number>()
  {
    let nextId = 1
    for (const [tableId] of state.tables.entries()) {
      tableIdToInternalId.set(tableId, nextId)
      nextId += 1
    }
  }

  for (const [tableId, table] of state.tables.entries()) {
    const parentInternalId = tableIdToInternalId.get(tableId)
    if (parentInternalId === undefined) continue

    for (const [colId, col] of Object.entries(table.columns)) {
      parentIds.push(parentInternalId)
      colIds.push(colId)
      // Prefer explicit `colRef` when present; fall back to 1-based index of insertion.
      const ref = typeof col.colRef === "number" ? col.colRef : columnIds.length + 1
      columnIds.push(ref)
      types.push(col.type ?? null)
      labels.push(col.label ?? null)
      parentPos.push(col.parentPos ?? null)
      isFormula.push(Boolean(col.isFormula))
      const formula = typeof col.formula === "string" ? col.formula : null
      formulas.push(formula)
      descriptions.push(col.description ?? null)
      widgetOptions.push(col.widgetOptions ?? null)
      displayCol.push(typeof col.displayColRef === "number" ? col.displayColRef : null)
      visibleCol.push(typeof col.visibleColRef === "number" ? col.visibleColRef : null)
    }
  }

  return {
    parentId: parentIds,
    colId: colIds,
    id: columnIds,
    type: types,
    label: labels,
    parentPos,
    isFormula,
    formula: formulas,
    description: descriptions,
    // Also expose legacy `descr` for robustness.
    descr: descriptions,
    widgetOptions,
    displayCol,
    visibleCol,
  }
}
