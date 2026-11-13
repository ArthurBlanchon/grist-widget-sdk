import type {
  GristFormulaKind,
  GristReplicaSelection,
  GristRowRecord,
  GristWidgetConfiguration,
  GristWidgetInteraction,
} from "./types"

/**
 * How row bodies were populated when the replica document was built (hint only).
 * Loaders should still treat omitted `rows` like `[]` via {@link normalizeReplicaTableInput}.
 */
export type GristDocumentMode = "schema-only" | "schema+samples" | "schema+data"

/**
 * Decoded row in replica JSON (`id` + fields). Same as wire `fetchTable` row objects,
 * but **not** columnar `Record<colId, unknown[]>` — that shape is only on `docApi.fetchTable`.
 */
export type GristReplicaRow = GristRowRecord

/**
 * Column metadata in replica JSON: Grist-native fields only (no samples / scan stats).
 * `formulaKind` is optional UI convenience; use {@link resolveGristFormulaKind} when missing.
 */
export type GristReplicaColumn = {
  /** Internal row id in `_grist_Tables_column` for this column. */
  colRef?: number
  type?: string
  label?: string
  parentPos?: number
  isFormula?: boolean
  formulaKind?: GristFormulaKind
  /** Present only when non-empty; may be truncated. */
  formula?: string
  description?: string
  widgetOptions?: Record<string, unknown>
  /** Internal `_grist_Tables_column` row id of the display helper for refs. */
  displayColRef?: number
  /** Internal `_grist_Tables_column` row id of the visible column. */
  visibleColRef?: number
}

export type GristReplicaTable = {
  label?: string
  columns?: Record<string, GristReplicaColumn>
  /** Decoded rows; omit or `[]` interchangeably until normalized at boundaries. */
  rows?: GristReplicaRow[]
  rowCount?: number
  dataOmitted?: boolean
  dataOmittedReason?: string
  error?: string
}

/**
 * Canonical Grist replica document: one JSON type for `getDocumentJson`, fixtures,
 * and `createGristEmulator({ document })`.
 */
export type GristReplicaDocument = {
  generatedAt: string
  /** Optional provenance label (e.g. widget id); hosts may log this when building or persisting replicas. */
  source?: string
  docName?: string
  mode?: GristDocumentMode
  tables: Record<string, GristReplicaTable>
  selection?: Partial<GristReplicaSelection> & { tableId?: string }
  widgetOptions?: Record<string, unknown>
  widgetInteraction?: GristWidgetInteraction
  configuration?: GristWidgetConfiguration
  accessToken?: { token: string; baseUrl: string; ttlMsecs: number } | null
}
