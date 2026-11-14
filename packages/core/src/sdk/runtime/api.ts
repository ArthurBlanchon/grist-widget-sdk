/**
 * `useGrist()`'s methods, created once per runtime: every one is
 * referentially stable for the widget's lifetime, and reads `grist` when
 * called (the emulator installs and removes it in tests).
 */

import { loadColumnMetadataByTable } from "../helpers/build-replica-document"
import { isGristNoiseColumn, type GristNoiseColumnsOptions } from "../helpers/grist-columns-filters"
import { fetchAttachmentBlob, getAttachmentDownloadUrl, type GristFetchedAttachmentBlob } from "../helpers/grist-attachment-download"
import { uploadGristAttachment, type GristAttachmentUploadResult } from "../helpers/grist-attachment-upload"
import { fetchWithGristAuth } from "../helpers/grist-fetch-with-auth"
import { deprecatedFunction } from "../helpers/deprecate"
import {
  fetchGristTableRows,
  materializeGristRowsFromColumnar,
  type FetchGristTableRowsOptions,
  type GristColumnarTable,
} from "../helpers/grist-table-data"
import type { GristUserActionTuple } from "../helpers/grist-user-actions"
import type {
  GristApplyUserActionsOptions,
  GristCursorPos,
  GristDocApi,
  GristFetchSelectedOptions,
  GristRowRecord,
  GristTableOperations,
} from "../types"
import type { GristRuntime } from "./runtime"

export type ListTablesOptions = {
  /** Include Grist's own tables (`_grist_*`, `GristHidden_*`). */
  includeSystem?: boolean
}

export type ListColumnsOptions = GristNoiseColumnsOptions & {
  /** Include every column, Grist's helper and bookkeeping ones too. */
  includeSystem?: boolean
}

export type GristColumnInfo = {
  colId: string
  type?: string
  label?: string
  isFormula?: boolean
  formula?: string
  description?: string
}

/** `fetchRows()` options: rows (the default) or Grist's columns. */
export type FetchRowsOptions = FetchGristTableRowsOptions & {
  /** Grist's column-oriented payload (`{ id: [...], Name: [...] }`) instead of rows. */
  columnar?: boolean
}

/**
 * A table's rows, each `{ id, ...cells }` under real column ids. Without a
 * table id, the widget's own table as its section shows it (filters and
 * sort applied); with one, any table (full access), in Grist's row order.
 * `{ columnar: true }` gives Grist's columns instead.
 */
export type FetchRows = {
  <T extends Record<string, unknown> = Record<string, unknown>>(
    tableId?: string | null,
    options?: FetchRowsOptions & { columnar?: false }
  ): Promise<GristRowRecord<T>[]>
  <T extends Record<string, unknown> = Record<string, unknown>>(options: FetchRowsOptions & { columnar?: false }): Promise<
    GristRowRecord<T>[]
  >
  (tableId: string | null | undefined, options: FetchRowsOptions & { columnar: true }): Promise<GristColumnarTable>
  (options: FetchRowsOptions & { columnar: true }): Promise<GristColumnarTable>
}

/** The methods `useGrist()` returns next to its state: reads, writes, attachments and the cursor. */
export type GristApi = {
  reload: () => Promise<void>
  fetchRows: FetchRows
  /** @deprecated Use `fetchRows({ columnar: true })` (or `fetchRows()` for rows). */
  fetchSelectedTable: (options?: GristFetchSelectedOptions) => Promise<GristColumnarTable>
  /** @deprecated Use `fetchRows(tableId, { columnar: true })` (or `fetchRows(tableId)` for rows). */
  fetchTable: (tableId: string) => Promise<GristColumnarTable>
  /** @deprecated Use `fetchRows(tableId, options)`. */
  fetchTableRows: <T extends Record<string, unknown> = Record<string, unknown>>(
    tableId: string,
    options?: FetchGristTableRowsOptions
  ) => Promise<GristRowRecord<T>[]>
  listTables: (options?: ListTablesOptions) => Promise<string[]>
  listColumns: (tableId: string, options?: ListColumnsOptions) => Promise<GristColumnInfo[]>
  table: GristTableOperations
  getTable: (tableId: string) => GristTableOperations
  applyActions: (actions: GristUserActionTuple[], options?: GristApplyUserActionsOptions) => Promise<unknown>
  setWidgetOptions: (options: Record<string, unknown>) => Promise<void>
  patchWidgetOptions: (patch: Record<string, unknown>) => Promise<void>
  setCursorPosition: (pos: GristCursorPos) => Promise<void>
  setLinkedRowSelection: (rowIds: number[] | null) => Promise<void>
  getAttachmentUrl: (attachmentId: string, options?: { readOnly?: boolean }) => Promise<string>
  fetchAttachmentBlob: (attachmentId: string, options?: { readOnly?: boolean }) => Promise<GristFetchedAttachmentBlob>
  uploadAttachment: (file: Blob | File, options?: { fileName?: string }) => Promise<GristAttachmentUploadResult>
  fetchWithAuth: (path: string, init?: RequestInit & { readOnly?: boolean }) => Promise<Response>
}

const ACCESS_ERROR = [/access not granted/i, /need higher access level/i, /requires.*full.*access/i, /RPC_ONCALL_ERROR Access/i]

export function isAccessInsufficientError(message: string): boolean {
  return ACCESS_ERROR.some((re) => re.test(message))
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function createGristApi(runtime: GristRuntime): GristApi {
  const docApi = (): GristDocApi => {
    if (runtime.getState().connection !== "ready" || typeof grist === "undefined" || !grist.docApi) {
      throw new Error("Grist is not ready: wait for useGrist().status === \"ready\".")
    }
    return grist.docApi
  }

  /** A read: an access refusal is kept for the alerts, cleared by the next read that succeeds. */
  const read = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      const out = await fn()
      if (runtime.getState().readError) runtime.update({ readError: null })
      return out
    } catch (err) {
      if (isAccessInsufficientError(message(err))) runtime.update({ readError: message(err) })
      throw err
    }
  }

  /**
   * A write: tracked in `actionStatus` / `actionError`. Overlapping writes
   * count as one run: `actionStatus` stays `"running"` until the last one
   * ends, then is `"error"` if any of them failed. A failure is shown in the
   * alerts and rejects the returned promise, which the SDK already handles:
   * a write nobody awaits (`onClick={() => w.table.update(...)}`) doesn't log
   * an unhandled rejection.
   */
  let running = 0
  let failure: string | null = null
  const write = <T>(fn: () => Promise<T>): Promise<T> => {
    if (running++ === 0) failure = null
    runtime.update({ actionStatus: "running", actionError: null })
    const done = (async () => {
      try {
        return await fn()
      } catch (err) {
        failure = message(err)
        throw err
      } finally {
        if (--running === 0) runtime.update(failure ? { actionStatus: "error", actionError: failure } : { actionStatus: "idle" })
      }
    })()
    done.catch(() => {})
    return done
  }

  const tableOps = (resolve: () => GristTableOperations): GristTableOperations => ({
    getTableId: () => resolve().getTableId(),
    create: ((records: never, opts?: never) => write(() => resolve().create(records, opts))) as GristTableOperations["create"],
    update: (records, opts) => write(() => resolve().update(records, opts)),
    upsert: (records, opts) => write(() => resolve().upsert(records, opts)),
    destroy: (ids) => write(() => resolve().destroy(ids)),
  })
  const tables = new Map<string, GristTableOperations>()

  const selectedColumns = (options?: GristFetchSelectedOptions): Promise<GristColumnarTable> =>
    read(async () => {
      const impl = docApi().fetchSelectedTable ?? grist.fetchSelectedTable
      if (!impl) throw new Error("fetchSelectedTable is not available in this Grist version")
      return (await impl({ keepEncoded: false, ...options })) as GristColumnarTable
    })
  const tableColumns = (tableId: string): Promise<GristColumnarTable> =>
    read(async () => (await docApi().fetchTable(tableId)) as GristColumnarTable)

  const fetchRows = (async (a?: string | null | FetchRowsOptions, b?: FetchRowsOptions) => {
    const tableId = typeof a === "string" ? a : null
    const { columnar, ...rowOptions } = (typeof a === "object" && a !== null ? a : b) ?? {}
    if (tableId === null) {
      // The section's rows: Grist decodes them unless `columns` asks for the SDK's decoding.
      const data = await selectedColumns(rowOptions.columns ? { keepEncoded: true } : undefined)
      return columnar ? data : materializeGristRowsFromColumnar(data, { order: "none", ...rowOptions })
    }
    if (columnar) return tableColumns(tableId)
    return read(() => fetchGristTableRows(docApi(), tableId, rowOptions))
  }) as FetchRows

  return {
    reload: () => runtime.reload(),

    fetchRows,
    fetchSelectedTable: deprecatedFunction("useGrist().fetchSelectedTable()", "use fetchRows({ columnar: true }), or fetchRows() for rows", selectedColumns),
    fetchTable: deprecatedFunction("useGrist().fetchTable()", "use fetchRows(tableId, { columnar: true }), or fetchRows(tableId) for rows", tableColumns),
    fetchTableRows: deprecatedFunction("useGrist().fetchTableRows()", "use fetchRows(tableId, options)", (tableId: string, options?: FetchGristTableRowsOptions) =>
      read(() => fetchGristTableRows(docApi(), tableId, options ?? {}))
    ) as never,
    listTables: (options) =>
      read(async () => {
        const all = [...(await docApi().listTables())]
        return options?.includeSystem ? all : all.filter((t) => !t.startsWith("_grist") && !t.startsWith("GristHidden_"))
      }),
    listColumns: (tableId, options) =>
      read(async () => {
        const meta = (await loadColumnMetadataByTable(docApi())).get(tableId)
        if (!meta) return []
        const noise: GristNoiseColumnsOptions = {
          excludeId: options?.excludeId ?? true,
          excludeGristHelpers: options?.excludeGristHelpers ?? true,
          excludeLoggingColumns: options?.excludeLoggingColumns ?? true,
          excludeManualSort: options?.excludeManualSort ?? true,
        }
        return [...meta]
          .filter(([colId, m]) => options?.includeSystem || !isGristNoiseColumn(colId, m, noise))
          .map(([colId, m]) => ({ colId, type: m.type, label: m.label, isFormula: m.isFormula, formula: m.formula, description: m.description }))
      }),

    table: tableOps(() => {
      if (!grist.selectedTable) throw new Error("grist.selectedTable is not available in this Grist version")
      return grist.selectedTable
    }),
    getTable: (tableId) => {
      let ops = tables.get(tableId)
      if (!ops) {
        tables.set(
          tableId,
          (ops = tableOps(() => {
            if (typeof grist.getTable !== "function") throw new Error("grist.getTable is not available in this Grist version")
            return grist.getTable(tableId)
          }))
        )
      }
      return ops
    },
    applyActions: (actions, options) => write(() => docApi().applyUserActions(actions, options)),

    setWidgetOptions: async (options) => {
      await grist.setOptions(options)
    },
    patchWidgetOptions: async (patch) => {
      const current = ((await grist.getOptions()) as Record<string, unknown> | null) ?? {}
      await grist.setOptions({ ...current, ...patch })
    },

    setCursorPosition: async (pos) => {
      if (!grist.setCursorPos) throw new Error("setCursorPos is not available in this Grist version")
      await grist.setCursorPos(pos)
    },
    setLinkedRowSelection: async (rowIds) => {
      if (!grist.setSelectedRows) throw new Error("setSelectedRows is not available in this Grist version")
      await grist.setSelectedRows(rowIds)
    },

    getAttachmentUrl: (id, options) => read(() => getAttachmentDownloadUrl(docApi(), id, options)),
    fetchAttachmentBlob: (id, options) => read(() => fetchAttachmentBlob(docApi(), id, options)),
    uploadAttachment: (file, options) => write(() => uploadGristAttachment(docApi(), file, options)),
    fetchWithAuth: (path, init) => read(() => fetchWithGristAuth(docApi(), path, init)),
  }
}
