import { useCallback, useEffect, useMemo, useState } from "react"

import { buildReplicaDocumentFromDocApi } from "./helpers/build-replica-document"
import { isGristNoiseColumn, type GristNoiseColumnsOptions } from "./helpers/grist-columns-filters"
import {
  buildReplicaJsonPayload,
  type ReplicaJsonIncludeRows,
} from "./helpers/replica-normalize"
import { isAccessInsufficientError } from "./runtime/api"
import { useGrist, useGristRuntime } from "./use-grist"
import type {
  GristDocumentMode,
  GristReplicaColumn,
  GristReplicaDocument,
  GristReplicaTable,
} from "./types"

/** What `extraExcludeColumn` is given for each column. */
export type GristColumnExcludeContext = {
  tableId: string
  colId: string
  col: GristReplicaColumn
}

/**
 * What `useGristSchema` reads. The connection (access level, columns) is the
 * widget's declaration, from `defineGristWidget()`: the hook reads it through
 * the provider `mountGristWidget()` renders.
 */
export type UseGristSchemaOptions = {
  tableId?: string
  excludeSystemTableData?: boolean
  /**
   * How row bodies are included in the replica document.
   * Default `schema+samples`.
   */
  replicaRowMode?: GristDocumentMode
  /** When `replicaRowMode` is `schema+samples`, max rows per table. Default 10. */
  sampleRowLimit?: number
  /** Stored on the replica as `source` (e.g. for logging). */
  source?: string
} & GristNoiseColumnsOptions & {
    extraExcludeColumn?: (ctx: GristColumnExcludeContext) => boolean
  }

/** Selected table slice with `tableId` for consumers that expect it on the object. */
export type GristSchemaTableView = GristReplicaTable & { tableId: string }

/** Options for `getDocumentJson` / `buildDocumentJson` on the return value of {@link useGristSchema}. */
export type ReplicaDocumentJsonOptions = {
  /** How row arrays appear in JSON. Default `full` (all rows currently on the document). */
  includeRows?: ReplicaJsonIncludeRows
  /** Cap per table when `includeRows` is `samples`. Default 10. */
  sampleRowLimit?: number
  space?: number
}

export type UseGristSchemaResult = {
  /** Canonical replica document. */
  document: GristReplicaDocument | null
  /** Same reference as `document`. */
  replicaDocument: GristReplicaDocument | null
  table: GristSchemaTableView | null
  documentJson: string | null
  getDocumentJson: (options?: ReplicaDocumentJsonOptions) => string | null
  buildDocumentJson: (document: GristReplicaDocument, options?: ReplicaDocumentJsonOptions) => string
  tableJson: string | null
  getTableJson: (options?: ReplicaDocumentJsonOptions) => string | null
  buildTableJson: (table: GristSchemaTableView, options?: ReplicaDocumentJsonOptions) => string
  isNoiseColumnId: (colId: string, col?: GristReplicaColumn) => boolean
  sortColumnIds: (colIds: string[], columns: Record<string, GristReplicaColumn>) => string[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

function filterReplicaDocumentColumns(
  document: GristReplicaDocument,
  options?: GristNoiseColumnsOptions,
  extraExcludeColumn?: (ctx: GristColumnExcludeContext) => boolean
): GristReplicaDocument {
  return {
    ...document,
    tables: Object.fromEntries(
      Object.entries(document.tables).map(([tableId, table]) => [
        tableId,
        {
          ...table,
          columns: Object.fromEntries(
            Object.entries(table.columns ?? {}).filter(([colId, col]) => {
              if (isGristNoiseColumn(colId, col, options)) return false
              if (extraExcludeColumn?.({ tableId, colId, col })) return false
              return true
            })
          ),
        },
      ])
    ),
  }
}

/**
 * Grist replica-document hook: metadata + optional decoded `rows` per table.
 */
export function useGristSchema(options?: UseGristSchemaOptions): UseGristSchemaResult {
  const requestedTableId = options?.tableId
  const excludeSystemTableData = options?.excludeSystemTableData ?? true
  const replicaRowMode = options?.replicaRowMode ?? "schema+samples"
  const sampleRowLimit = options?.sampleRowLimit ?? 10
  const replicaSource = options?.source
  const excludeId = options?.excludeId ?? true
  const excludeGristHelpers = options?.excludeGristHelpers ?? true
  const excludeLoggingColumns = options?.excludeLoggingColumns ?? true
  const excludeManualSort = options?.excludeManualSort ?? false
  const extraExcludeColumn = options?.extraExcludeColumn

  const w = useGrist()
  const connection = useGristRuntime()
  const readyError = w.status === "error" || w.status === "unavailable" ? w.error : null
  const docApi = w.status === "ready" && typeof grist !== "undefined" ? (grist.docApi ?? null) : null

  const [document, setDocument] = useState<GristReplicaDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!docApi) return
    const includeRowsForBuild: false | "samples" | "full" =
      replicaRowMode === "schema-only" ? false : replicaRowMode === "schema+data" ? "full" : "samples"
    setLoading(true)
    setError(null)
    try {
      const buildOpts = {
        includeSystemTableData: !excludeSystemTableData,
        includeRows: includeRowsForBuild,
        sampleRowLimit,
        source: replicaSource,
      }
      const raw = await buildReplicaDocumentFromDocApi(docApi, buildOpts)
      const filtered = filterReplicaDocumentColumns(
        raw,
        {
          excludeId,
          excludeGristHelpers,
          excludeLoggingColumns,
          excludeManualSort,
        },
        extraExcludeColumn
      )
      setDocument(filtered)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setDocument(null)
      setError(message)
      // The access alert above the widget says what to change in Grist.
      if (isAccessInsufficientError(message)) connection?.runtime.update({ readError: message })
    } finally {
      setLoading(false)
    }
  }, [
    docApi,
    connection,
    excludeSystemTableData,
    replicaRowMode,
    sampleRowLimit,
    excludeId,
    excludeGristHelpers,
    excludeLoggingColumns,
    excludeManualSort,
    extraExcludeColumn,
    replicaSource,
  ])

  useEffect(() => {
    if (docApi) void load()
  }, [docApi, load])

  const buildDocumentJson = useCallback((target: GristReplicaDocument, options?: ReplicaDocumentJsonOptions): string => {
    const includeRows = options?.includeRows ?? "full"
    const space = options?.space ?? 2
    const payload = buildReplicaJsonPayload(target, {
      includeRows,
      sampleRowLimit: options?.sampleRowLimit ?? sampleRowLimit,
    })
    return JSON.stringify(payload, null, space)
  }, [sampleRowLimit])

  const getDocumentJson = useCallback(
    (options?: ReplicaDocumentJsonOptions): string | null => {
      if (!document) return null
      return buildDocumentJson(document, options)
    },
    [document, buildDocumentJson]
  )

  const table = useMemo((): GristSchemaTableView | null => {
    if (!document || !requestedTableId) return null
    const slice = document.tables[requestedTableId]
    if (!slice) return null
    return { tableId: requestedTableId, ...slice }
  }, [document, requestedTableId])

  const buildTableJson = useCallback(
    (target: GristSchemaTableView, options?: ReplicaDocumentJsonOptions): string => {
      const includeRows = options?.includeRows ?? "full"
      const limit = options?.sampleRowLimit ?? sampleRowLimit
      const space = options?.space ?? 2
      const { tableId, ...rest } = target
      let body: GristReplicaTable = { ...rest }
      if (includeRows === "none") {
        const { rows: _r, ...r } = body
        body = r
      } else if (includeRows === "samples") {
        const r = body.rows ?? []
        body = { ...body, rows: r.slice(0, limit) }
      }
      return JSON.stringify({ tableId, ...body }, null, space)
    },
    [sampleRowLimit]
  )

  const getTableJson = useCallback(
    (options?: ReplicaDocumentJsonOptions): string | null => {
      if (!table) return null
      return buildTableJson(table, options)
    },
    [table, buildTableJson]
  )

  const noiseColumnMatcher = useCallback(
    (colId: string, col?: GristReplicaColumn): boolean =>
      isGristNoiseColumn(colId, col, {
        excludeId,
        excludeGristHelpers,
        excludeLoggingColumns,
        excludeManualSort,
      }),
    [excludeId, excludeGristHelpers, excludeLoggingColumns, excludeManualSort]
  )

  const sortColumns = useCallback((colIds: string[], columns: Record<string, GristReplicaColumn>): string[] => {
    return [...colIds].sort((a, b) => {
      const la = (columns[a]?.label || a).toLowerCase()
      const lb = (columns[b]?.label || b).toLowerCase()
      if (la !== lb) return la.localeCompare(lb)
      return a.localeCompare(b)
    })
  }, [])

  return {
    document,
    replicaDocument: document,
    table,
    documentJson: document ? buildDocumentJson(document) : null,
    getDocumentJson,
    buildDocumentJson,
    tableJson: table ? buildTableJson(table) : null,
    getTableJson,
    buildTableJson,
    isNoiseColumnId: noiseColumnMatcher,
    sortColumnIds: sortColumns,
    loading,
    error: readyError ?? error,
    reload: load,
  }
}
