import { applyUserActions } from "../core/action-engine"
import { rowsToColumnar } from "../core/columnar"
import { getTable, synthesizeTablesColumnMeta, synthesizeTablesMeta } from "../core/document"
import type { EventBus } from "../core/event-bus"
import type { EmulatorDocumentState } from "../core/types"
import type { GristDocApiImpl } from "./types"

/**
 * `GristDocAPI` host implementation. Backs `grist.docApi.*` methods such as
 * `getDocName`, `listTables`, `fetchTable`, `applyUserActions` and
 * `getAccessToken`.
 *
 * `applyUserActions` is the only mutation entry point — every widget write
 * lands here, so tests can listen on the bus for `user-action` events to
 * assert exactly which actions a UI flow generated.
 */
export function createGristDocApiImpl(state: EmulatorDocumentState, bus: EventBus): GristDocApiImpl {
  return {
    async getDocName() {
      return state.docName
    },

    async listTables() {
      return [...state.tables.keys()]
    },

    async fetchTable(tableId) {
      if (tableId === "_grist_Tables") {
        return synthesizeTablesMeta(state)
      }
      if (tableId === "_grist_Tables_column") {
        return synthesizeTablesColumnMeta(state)
      }
      const table = getTable(state, tableId)
      return rowsToColumnar(table, table.rows)
    },

    async applyUserActions(actions) {
      const result = applyUserActions(state, bus, actions)
      return { retValues: result.retValues }
    },

    async getAccessToken() {
      if (!state.accessToken) {
        const err = new Error("getAccessToken not available (no token configured on emulator)")
        // Mirror Grist's protocol: rejected stub call.
        throw err
      }
      return { ...state.accessToken }
    },
  }
}
