import type {
  GristDocApi,
  GristDocumentMode,
  GristReplicaColumn,
  GristReplicaDocument,
  GristReplicaTable,
} from "../types"
import { computeRowCount, decodeColumnarToReplicaRows, type GristColumnarTable } from "./grist-table-data"
import { inferGristFormulaKind } from "./grist-schema-formula"
import { parseGristWidgetOptionsCell } from "./grist-widget-options"
import { coerceGristDocApiRefRowId } from "./grist-value-codec"

export type ReplicaTableColumnMetaLite = {
  colRef?: number
  type?: string
  label?: string
  parentPos?: number
  isFormula?: boolean
  formula?: string
  description?: string
  widgetOptions?: Record<string, unknown>
  displayColRef?: number
  visibleColRef?: number
}

const FORMULA_PREVIEW_MAX = 500

function readCellStr(table: Record<string, unknown[]>, key: string, rowIndex: number): string | undefined {
  const col = table[key]
  if (!Array.isArray(col)) return undefined
  const v = col[rowIndex]
  if (v === null || v === undefined) return undefined
  if (typeof v === "string") return v
  if (typeof v === "number" || typeof v === "boolean") return String(v)
  return undefined
}

function readCellNum(table: Record<string, unknown[]>, key: string, rowIndex: number): number | undefined {
  const col = table[key]
  if (!Array.isArray(col)) return undefined
  const v = col[rowIndex]
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return undefined
}

function pickColumnMeta(meta: ReplicaTableColumnMetaLite | undefined): GristReplicaColumn {
  if (!meta) return {}
  const out: GristReplicaColumn = {}
  if (meta.colRef !== undefined) out.colRef = meta.colRef
  if (meta.type) out.type = meta.type
  if (meta.label) out.label = meta.label
  if (meta.parentPos !== undefined) out.parentPos = meta.parentPos
  if (meta.isFormula) out.isFormula = true
  const formulaRaw = meta.formula?.trim() ?? ""
  out.formulaKind = inferGristFormulaKind(Boolean(meta.isFormula), formulaRaw)
  if (formulaRaw) {
    out.formula =
      formulaRaw.length > FORMULA_PREVIEW_MAX ? `${formulaRaw.slice(0, FORMULA_PREVIEW_MAX)}...` : formulaRaw
  }
  if (meta.description) out.description = meta.description
  if (meta.widgetOptions && Object.keys(meta.widgetOptions).length > 0) {
    out.widgetOptions = meta.widgetOptions
  }
  if (meta.displayColRef !== undefined) out.displayColRef = meta.displayColRef
  if (meta.visibleColRef !== undefined) out.visibleColRef = meta.visibleColRef
  return out
}

export async function loadColumnMetadataByTable(
  docApi: GristDocApi
): Promise<Map<string, Map<string, ReplicaTableColumnMetaLite>>> {
  const byTable = new Map<string, Map<string, ReplicaTableColumnMetaLite>>()
  try {
    const tables = await docApi.fetchTable("_grist_Tables")
    const columns = await docApi.fetchTable("_grist_Tables_column")
    const tableIds = tables.tableId
    const tableInternalIds = tables.id
    if (!Array.isArray(tableIds) || !Array.isArray(tableInternalIds)) return byTable

    const internalIdToTableId = new Map<number, string>()
    for (let i = 0; i < tableInternalIds.length; i++) {
      const tid = tableIds[i]
      const iid = coerceGristDocApiRefRowId(tableInternalIds[i])
      if (typeof tid === "string" && iid !== undefined) internalIdToTableId.set(iid, tid)
    }

    const parentIds = columns.parentId
    const colIds = columns.colId
    const columnIds = columns.id
    if (
      !Array.isArray(parentIds) ||
      !Array.isArray(colIds) ||
      !Array.isArray(columnIds) ||
      parentIds.length !== colIds.length ||
      colIds.length !== columnIds.length
    ) {
      return byTable
    }

    const n = parentIds.length
    for (let i = 0; i < n; i++) {
      const parentRowId = coerceGristDocApiRefRowId(parentIds[i])
      const colRef = coerceGristDocApiRefRowId(columnIds[i])
      const colId = colIds[i]
      if (parentRowId === undefined || colRef === undefined || typeof colId !== "string") continue
      const tableId = internalIdToTableId.get(parentRowId)
      if (!tableId) continue

      let colMap = byTable.get(tableId)
      if (!colMap) {
        colMap = new Map()
        byTable.set(tableId, colMap)
      }

      const parentPos = readCellNum(columns, "parentPos", i)
      const isFormulaCol = columns.isFormula
      const isFormula = Array.isArray(isFormulaCol) ? Boolean(isFormulaCol[i]) : false

      const woCol = columns.widgetOptions
      const widgetOptions =
        Array.isArray(woCol) && i < woCol.length ? parseGristWidgetOptionsCell(woCol[i]) : undefined
      const displayColRef = coerceGristDocApiRefRowId(
        Array.isArray(columns.displayCol) ? columns.displayCol[i] : undefined
      )
      const visibleColRef = coerceGristDocApiRefRowId(
        Array.isArray(columns.visibleCol) ? columns.visibleCol[i] : undefined
      )

      colMap.set(colId, {
        colRef,
        type: readCellStr(columns, "type", i),
        label: readCellStr(columns, "label", i),
        parentPos: parentPos !== undefined ? parentPos : undefined,
        isFormula,
        formula: readCellStr(columns, "formula", i),
        description: readCellStr(columns, "description", i) ?? readCellStr(columns, "descr", i),
        widgetOptions,
        displayColRef,
        visibleColRef,
      })
    }
  } catch {
    // Metadata is best-effort; document build still works from cell data alone.
  }
  return byTable
}

export function orderedColumnIds(
  data: Record<string, unknown[]>,
  metaByCol: Map<string, ReplicaTableColumnMetaLite>
): string[] {
  const keys = Object.keys(data).filter((k) => Array.isArray(data[k]))
  keys.sort((a, b) => {
    const pa = metaByCol.get(a)?.parentPos
    const pb = metaByCol.get(b)?.parentPos
    if (pa !== undefined && pb !== undefined && pa !== pb) return pa - pb
    if (pa !== undefined && pb === undefined) return -1
    if (pa === undefined && pb !== undefined) return 1
    return a.localeCompare(b)
  })
  return keys
}

/** Build replica column metadata from columnar `fetchTable` + `_grist_Tables_column` maps. */
export function buildReplicaColumnsFromColumnar(
  data: Record<string, unknown[]>,
  colMeta: Map<string, ReplicaTableColumnMetaLite>
): Record<string, GristReplicaColumn> {
  const columnIds = orderedColumnIds(data, colMeta)
  const columns: Record<string, GristReplicaColumn> = {}
  for (const colId of columnIds) {
    const arr = data[colId]
    if (!Array.isArray(arr)) continue
    const meta = colMeta.get(colId)
    columns[colId] = pickColumnMeta(meta)
  }
  return columns
}

function rowModeFromIncludeRows(includeRows: false | "samples" | "full"): GristDocumentMode {
  if (includeRows === false) return "schema-only"
  if (includeRows === "samples") return "schema+samples"
  return "schema+data"
}

export type BuildReplicaDocumentFromDocApiOptions = {
  /** When false (default), skip fetching row data for `tableId` starting with `_grist`. */
  includeSystemTableData?: boolean
  /**
   * Row bodies: omit (`false`), first N (`samples`), or full decode (`full`).
   * Default `samples`.
   */
  includeRows?: false | "samples" | "full"
  /** Max rows per table when `includeRows` is `samples`. Default 10. */
  sampleRowLimit?: number
  /** Set on the replica as `source` for host logging / provenance. */
  source?: string
}

/**
 * Build {@link GristReplicaDocument} from a host `docApi`:
 * metadata from `_grist_Tables` / `_grist_Tables_column` when readable, plus optional decoded `rows`.
 *
 * Prefer {@link useGrist}'s `buildReplicaDocumentFromDocApi()` when you already use the primary hook.
 */
export async function buildReplicaDocumentFromDocApi(
  docApi: GristDocApi,
  options?: BuildReplicaDocumentFromDocApiOptions
): Promise<GristReplicaDocument> {
  const includeSystemTableData = options?.includeSystemTableData ?? false
  const includeRows = options?.includeRows ?? "samples"
  const sampleRowLimit = options?.sampleRowLimit ?? 10
  const rowMode = rowModeFromIncludeRows(includeRows)

  const metaByTable = await loadColumnMetadataByTable(docApi)

  let docName: string | undefined
  try {
    docName = String(await Promise.resolve(docApi.getDocName()))
  } catch {
    docName = undefined
  }

  const tableIdsRaw = await Promise.resolve(docApi.listTables())
  const tableIds = Array.isArray(tableIdsRaw) ? [...tableIdsRaw] : []

  const tables: Record<string, GristReplicaTable> = {}

  for (const tableId of tableIds) {
    const omitData = !includeSystemTableData && tableId.startsWith("_grist")
    if (omitData) {
      tables[tableId] = {
        rowCount: 0,
        dataOmitted: true,
        dataOmittedReason:
          "Row scan skipped for tables whose id starts with `_grist` unless `includeSystemTableData` is true.",
        columns: {},
      }
      continue
    }

    try {
      const data = (await docApi.fetchTable(tableId)) as GristColumnarTable
      const rowCount = computeRowCount(data)
      const colMeta = metaByTable.get(tableId) ?? new Map<string, ReplicaTableColumnMetaLite>()
      const columnIds = orderedColumnIds(data, colMeta)
      const columns = buildReplicaColumnsFromColumnar(data, colMeta)

      const table: GristReplicaTable = { columns, rowCount }
      if (includeRows === "full") {
        table.rows = decodeColumnarToReplicaRows(data, columnIds, columns)
      } else if (includeRows === "samples") {
        table.rows = decodeColumnarToReplicaRows(data, columnIds, columns, sampleRowLimit)
      }
      tables[tableId] = table
    } catch (err) {
      tables[tableId] = {
        rowCount: 0,
        error: err instanceof Error ? err.message : String(err),
        columns: {},
      }
    }
  }

  const out: GristReplicaDocument = {
    generatedAt: new Date().toISOString(),
    docName,
    mode: rowMode,
    tables,
  }
  if (options?.source !== undefined && options.source !== "") {
    out.source = options.source
  }
  return out
}
