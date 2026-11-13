/**
 * Core types for the in-memory Grist emulator document model.
 *
 * The emulator is a faithful, in-process re-implementation of Grist's
 * server-side contract — it owns a typed document and derives every event
 * the widget receives (`onRecord`, `onRecords`, `onOptions`, `onNewRecord`)
 * from mutations applied to that document.
 *
 * No DOM, no `window`, no React in this layer.
 */

import type {
  GristReplicaColumn,
  GristReplicaSelection,
  GristRowRecord,
  GristWidgetConfiguration,
  GristWidgetInteraction,
} from "../../sdk/types"

export type EmulatorRowId = number

/**
 * Column metadata for the emulator: {@link GristReplicaColumn} plus in-process
 * `formulaFn` (never serialized in replica JSON).
 *
 * - **`formula`** — original Grist formula text from the replica (when present).
 * - **`inferredFormula`** — emulator-only companion string: explicit value, else mirrors
 *   `formula`, else a stable placeholder when only `formulaFn` is provided.
 */
export type EmulatorColumn = GristReplicaColumn & {
  formulaFn?: (row: GristRowRecord, ctx: EmulatorFormulaContext) => unknown
  /** Emulator-only; not part of {@link GristReplicaColumn} JSON. See type JSDoc above. */
  inferredFormula?: string
}

export type EmulatorFormulaContext = {
  table: EmulatorTable
  document: EmulatorDocumentState
}

export type EmulatorTable = {
  tableId: string
  /** Optional human-readable label (used by the inspector). */
  label?: string
  columns: Record<string, EmulatorColumn>
  rows: GristRowRecord[]
}

export type EmulatorDocumentState = {
  /** Logical doc name returned by `getDocName()`. */
  docName: string
  /**
   * `tableId` → `EmulatorTable`. The order of insertion is preserved for
   * `listTables()` (Grist's behaviour).
   */
  tables: Map<string, EmulatorTable>
  /** Current widget selection (which table, which row). */
  selection: GristReplicaSelection
  /** Persisted widget options, exposed via `WidgetAPI.{get,set}Option`. */
  widgetOptions: Record<string, unknown>
  /**
   * Widget interaction info passed alongside `onOptions`. Lets tests assert
   * `access_level`, theme, etc.
   */
  widgetInteraction: GristWidgetInteraction
  /** Last `ready()` payload received from the widget. */
  configuration: GristWidgetConfiguration | null
  /**
   * Mock REST access token returned by `getAccessToken()`. Set to `null` to
   * simulate unauthenticated widgets (the call will reject).
   */
  accessToken: { token: string; baseUrl: string; ttlMsecs: number } | null
}
