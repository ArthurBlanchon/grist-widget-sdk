import { encodeForWire, rowToRecord, rowsToColumnar } from "../core/columnar"
import { findRow, getSelectedTable } from "../core/document"
import type { EventBus } from "../core/event-bus"
import { resolveMappings } from "../core/mappings"
import type { EmulatorDocumentState, EmulatorTable } from "../core/types"
import type { GristViewImpl } from "./types"

/**
 * `GristView` host implementation.
 *
 * Exposes the section-scoped data API the widget uses through
 * `grist.docApi.fetchSelectedTable()`, `fetchSelectedRecord()` and
 * `setCursorPos()`. Reads from the emulator state, writes to the same state
 * via the action engine where applicable, and emits events on the bus so
 * subscribers (transports, inspector, tests) stay in sync.
 *
 * IMPORTANT: `fetchSelectedTable` always returns Grist's **columnar** wire
 * shape. The production `grist-plugin-api.js` wrapper (which the iframe
 * transport talks to) expects the raw RPC stub to return columnar and does
 * the `format: "rows"` transposition + `keepEncoded: false` decoding itself.
 * The emulator has no such wrapper: its host side (`encodeForWire`) decodes
 * lists unless `keepEncoded` is true (#133), which equals Grist on every SDK
 * path (they pass `keepEncoded: false`). A transport through the real
 * plugin API would need it to return the encoded form instead.
 * Returning rows here used to crash the wrapper's `mapValues(data, col =>
 * col.map(decodeObject))` pass — `data` was an array, `col` was a row object
 * with no `.map` method — so widgets observed `records === null` forever.
 * The inline transport mirrors the same wrapper semantics in
 * `transports/inline.ts` so widget code sees identical results in both modes.
 */
export function createGristViewImpl(state: EmulatorDocumentState, bus: EventBus): GristViewImpl {
  return {
    async fetchSelectedTable(options) {
      const table = getSelectedTable(state)
      const data = rowsToColumnar(table, table.rows, { keepEncoded: options?.keepEncoded })
      const shown = refsShown(state, table, options)
      for (const [col, show] of shown) data[col] = table.rows.map((row) => show(row))
      return onlyMapped(state, data)
    },

    async fetchSelectedRecord(rowId, options) {
      const table = getSelectedTable(state)
      const row = findRow(table, rowId)
      if (!row) throw new Error(`No row ${rowId} in ${table.tableId}`)
      const data = rowToRecord(table, row, { keepEncoded: options?.keepEncoded })
      for (const [col, show] of refsShown(state, table, options)) data[col] = show(row)
      return onlyMapped(state, data)
    },

    async allowSelectBy() {
      return state.configuration?.allowSelectBy ?? false
    },

    async setSelectedRows(rowIds) {
      if (!rowIds || rowIds.length === 0) {
        state.selection.rowId = null
      } else {
        state.selection.rowId = rowIds[0]
      }
      bus.emit({
        type: "cursor-change",
        tableId: state.selection.tableId,
        rowId: state.selection.rowId,
      })
    },

    async setCursorPos(cursor) {
      const tableId = state.selection.tableId
      if (typeof cursor.rowId === "number") state.selection.rowId = cursor.rowId
      state.selection.cursor = { ...state.selection.cursor, ...cursor }
      bus.emit({
        type: "cursor-change",
        tableId,
        rowId: state.selection.rowId,
        cursor: state.selection.cursor,
      })
    },
  }
}

/**
 * What the section sends, as Grist's `GristViewImpl._visibleColumns` does:
 * once the widget declares columns (even none) and the section has a saved
 * mapping, only the mapped columns, and the row id. A widget that needs the
 * others reads the table itself (`fetchRows(tableId)`, full access).
 */
function onlyMapped<T extends Record<string, unknown>>(state: EmulatorDocumentState, data: T): T {
  const mappings = resolveMappings(state)
  const declared = state.configuration?.columns
  if (!declared || !mappings) return data
  // Only the declared names count, as in Grist's mappedColumns.
  const names = declared.map((c) => (typeof c === "string" ? c : c.name))
  const mapped = new Set(names.flatMap((n) => [mappings[n]].flat()).filter((c): c is string => typeof c === "string"))
  return Object.fromEntries(Object.entries(data).filter(([col]) => col === "id" || mapped.has(col))) as T
}

type Row = Record<string, unknown> & { id: number }

/**
 * A reference as Grist sends it to a widget (`expandRefs`, its default
 * unless `cellFormat` is "typed"): the value its column shows, looked up
 * now in its visible column (or, without one, in the display helper it
 * names), not the row id; a RefList, the list of those. A reference showing
 * the row id stays the id. A widget that needs the ids reads the table
 * (`fetchRows(tableId)`, full access).
 */
function refsShown(
  state: EmulatorDocumentState,
  table: EmulatorTable,
  options: { keepEncoded?: boolean; expandRefs?: boolean; cellFormat?: string } | undefined
): Map<string, (row: Row) => unknown> {
  const out = new Map<string, (row: Row) => unknown>()
  if (!(options?.expandRefs ?? options?.cellFormat !== "typed")) return out
  const keepEncoded = options?.keepEncoded
  for (const [colId, col] of Object.entries(table.columns)) {
    const m = /^(Ref|RefList):(.+)$/.exec(col.type ?? "")
    if (!m) continue
    const target = state.tables.get(m[2]!)
    const visible = target && Object.entries(target.columns).find(([, c]) => c.colRef !== undefined && c.colRef === col.visibleColRef)
    if (!target || !visible) {
      // Without a visible column, only the helper the column names exactly (displayColRef).
      const helper = Object.entries(table.columns).find(([, c]) => c.colRef !== undefined && c.colRef === col.displayColRef && c.colRef !== col.colRef)?.[0]
      if (helper) out.set(colId, (row) => row[helper])
      continue
    }
    const [visibleId, visibleCol] = visible
    const byId = new Map(target.rows.map((r) => [r.id, r]))
    // An empty or dangling reference shows its visible column's empty value.
    const empty = /^(Text|Choice)$/.test(visibleCol.type ?? "") ? "" : null
    const one = (id: unknown) => {
      const hit = typeof id === "number" && id > 0 ? byId.get(id) : undefined
      return hit ? encodeForWire(hit[visibleId], visibleCol.type, keepEncoded) : empty
    }
    out.set(
      colId,
      m[1] === "Ref"
        ? (row) => one(row[colId])
        : (row) => {
            const raw = row[colId]
            const ids = Array.isArray(raw) ? (raw[0] === "L" ? raw.slice(1) : raw) : []
            const labels = ids.map(one)
            return keepEncoded ? ["L", ...labels] : labels
          }
    )
  }
  return out
}
