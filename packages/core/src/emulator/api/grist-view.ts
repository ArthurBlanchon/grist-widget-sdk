import { rowToRecord, rowsToColumnar } from "../core/columnar"
import { findRow, getSelectedTable } from "../core/document"
import type { EventBus } from "../core/event-bus"
import { resolveMappings } from "../core/mappings"
import type { EmulatorDocumentState } from "../core/types"
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
      return onlyMapped(state, rowsToColumnar(table, table.rows, { keepEncoded: options?.keepEncoded }))
    },

    async fetchSelectedRecord(rowId, options) {
      const table = getSelectedTable(state)
      const row = findRow(table, rowId)
      if (!row) throw new Error(`No row ${rowId} in ${table.tableId}`)
      return onlyMapped(state, rowToRecord(table, row, { keepEncoded: options?.keepEncoded }))
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
