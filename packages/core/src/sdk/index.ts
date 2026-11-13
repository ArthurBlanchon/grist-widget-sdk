/**
 * grist-widget-sdk: React hooks for Grist custom widgets.
 *
 * A widget is `mountGristWidget()` (from `grist-widget-sdk/app`) plus
 * components that call `useGrist()`:
 *
 * ```tsx
 * export const widget = defineGristWidget({
 *   requiredAccess: "full",
 *   columns: [{ name: "Title", type: "Text" }, { name: "Done", type: "Bool" }],
 * })
 *
 * export default function App() {
 *   const w = widget.useGrist()
 *   if (!w.mappedRecord) return <p>Select a row.</p>
 *   const { Title, Done } = w.mappedRecord
 *   return <button onClick={() => w.updateRecord({ Done: !Done })}>{Title}</button>
 * }
 * ```
 *
 * Widget code reads Grist only through these hooks, never the `grist` global.
 */

// The widget's declaration
export {
  defineGristWidget,
  type GristWidget,
  type GristWidgetDefinition,
  type GristWidgetRow,
} from "./define-widget"

// Connection, data and writes
export {
  useGrist,
  useGristContext,
  useGristOptional,
  type FetchRows,
  type FetchRowsOptions,
  type GristColumnInfo,
  type GristRecordPatch,
  type GristTheme,
  type GristWidgetActionStatus,
  type GristWidgetMode,
  type GristWidgetStatus,
  type ListColumnsOptions,
  type ListTablesOptions,
  type UseGristOptions,
  type UseGristResult,
} from "./use-grist"
export { GristWidgetProvider, type GristWidgetProviderProps } from "./components/grist-widget-provider"
export { GristBoundary, type GristBoundaryProps } from "./components/grist-boundary"
export type { GristSdkAlertKind } from "./helpers/grist-sdk-alerts"
export type { ValidateColumnMappingsResult } from "./helpers/grist-mappings"

// The document's schema and sample rows (full access)
export {
  useGristSchema,
  type GristSchemaTableView,
  type ReplicaDocumentJsonOptions,
  type UseGristSchemaOptions,
  type UseGristSchemaResult,
} from "./use-grist-schema"

// The page's title and meta tags
export { useWidgetMetadata, type UseWidgetMetadataInput } from "./use-widget-metadata"

// Cells
export { tableDataToRows, type GristColumnarTable } from "./helpers/grist-table-data"
export type { GristNoiseColumnsOptions } from "./helpers/grist-columns-filters"
export { decodeGristValue, encodeGristValue, isGristCellError } from "./helpers/grist-value-codec"
export { normalizeGristChoiceListEntries, type GristChoiceListEntry } from "./helpers/grist-widget-options"
export { resolveGristFormulaKind } from "./helpers/grist-schema-formula"

// Attachments
export { extractGristAttachmentId, extractGristAttachmentIdsFromCell } from "./helpers/grist-attachment-download"
export type { GristFetchedAttachmentBlob } from "./helpers/grist-attachment-download"
export {
  gristAttachmentCellValue,
  gristAttachmentCellValues,
  mergeGristAttachmentCellValue,
  type GristAttachmentUploadResult,
} from "./helpers/grist-attachment-upload"

// User actions for `applyActions`: deprecated here, in `grist-widget-sdk/actions` now
export {
  gristAddColumnAction,
  gristAddRecordAction,
  gristAddTableAction,
  gristAddVisibleColumnAction,
  gristModifyColumnAction,
  gristRemoveColumnAction,
  gristRemoveRecordAction,
  gristRenameColumnAction,
  gristUpdateRecordAction,
} from "./deprecated-actions"
export type { GristUserActionTuple } from "./helpers/grist-user-actions"

// Typed reads: each mapped cell checked against its declared type
export { checkGristCell, encodeGristCell, type GristCellIssue, type GristMappedRow, type StandardSchema } from "./runtime/cells"

// Grist's data shapes
export type {
  GristApplyUserActionsOptions,
  GristColumnsToMap,
  GristColumnToMap,
  GristCursorPos,
  GristDocumentMode,
  GristFetchSelectedOptions,
  GristFormulaKind,
  GristReadyOptions,
  GristReplicaColumn,
  GristReplicaDocument,
  GristReplicaRow,
  GristReplicaTable,
  GristRequiredAccess,
  GristRowRecord,
  GristTableOperations,
  GristWidgetColumnMap,
  GristWidgetInteraction,
} from "./types"
