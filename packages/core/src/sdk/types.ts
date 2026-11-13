/** Access level passed to `grist.ready({ requiredAccess })`. */
export type GristRequiredAccess = "none" | "read table" | "full"

/**
 * Single-column declaration in `grist.ready({ columns })`.
 * Mirrors Grist `ColumnToMap`. See https://support.getgrist.com/code/interfaces/grist_plugin_api.ColumnToMap/
 */
export type GristColumnToMap = {
  /** Logical column name your widget code uses (must be a valid JSON property name). */
  name: string
  /** Short label shown in the section mapping UI. */
  title?: string | null
  /** Long help text for the section mapping UI. */
  description?: string | null
  /** Comma-separated list of allowed Grist column types. Defaults to `"Any"`. */
  type?: string
  /** Mark column as optional (default: required). */
  optional?: boolean
  /** Allow multiple column assignment (resulting `mappings[name]` becomes `string[]`). */
  allowMultiple?: boolean
  /** Match column type strictly (so `"Any"` matches only `"Any"`). */
  strictType?: boolean
}

/** Argument shape for `grist.ready({ columns })`. */
export type GristColumnsToMap = ReadonlyArray<string | GristColumnToMap>

/**
 * Mapping returned by Grist between logical widget column names and real table column ids.
 * Single mappings are `string`; `allowMultiple` columns are `string[]`.
 */
export type GristWidgetColumnMap = Record<string, string | string[] | undefined>

/** A row from `grist.onRecord` or `fetchTable`. Always carries a numeric `id`. */
export type GristRowRecord<T = Record<string, unknown>> = T & { id: number }

/** Arguments accepted by `grist.ready` for custom widgets. */
export type GristReadyOptions = {
  requiredAccess?: GristRequiredAccess
  columns?: GristColumnsToMap
  allowSelectBy?: boolean
  hasCustomOptions?: boolean
  onEditOptions?: () => void | Promise<void>
}

/** Optional second argument to `docApi.applyUserActions`. */
export type GristApplyUserActionsOptions = {
  /** Description shown in the document undo stack. */
  desc?: string
}

/**
 * Last `grist.ready` options mirrored with the emulator (optional on fixtures).
 */
export type GristWidgetConfiguration = {
  requiredAccess?: GristRequiredAccess
  columns?: GristColumnsToMap
  allowSelectBy?: boolean
  hasCustomOptions?: boolean
}

/**
 * How Grist treats the column (from `_grist_Tables_column` `isFormula` + `formula`).
 * `empty_slot` is Grist's "empty column" state: `isFormula` true with no formula text.
 */
export type GristFormulaKind = "computed" | "trigger" | "none" | "empty_slot"

/** Options for `fetchSelectedTable` / `fetchSelectedRecord` on `docApi` (GristView). */
export type GristFetchSelectedOptions = {
  keepEncoded?: boolean
  format?: "rows" | "columns" | string
}

/** Argument to `grist.setCursorPos` (subset of Grist `CursorPos`). */
export type GristCursorPos = {
  rowId?: number
  field?: string
  colRef?: string
  sectionId?: number
}

/** Selection slice persisted on replica fixtures (emulator / widget). */
export type GristReplicaSelection = {
  tableId: string
  rowId: number | "new" | null
  mappings?: GristWidgetColumnMap | null
  cursor?: GristCursorPos
}

/**
 * Linking state reported by Grist in `onOptions` settings (`InteractionOptions.linking`).
 * @see https://github.com/gristlabs/grist-core/blob/main/app/plugin/CustomSectionAPI.ts
 */
export type GristWidgetLinkingInfo = {
  /** Incoming link type, or `null` when this section is not driven by a selector. */
  asTarget: string | null
  /** True when another section uses this widget as a link source. */
  asSource: boolean
}

/**
 * Second argument to `grist.onOptions` — document ↔ widget relationship (subset of Grist `InteractionOptions`).
 */
export type GristWidgetInteraction = {
  access_level?: string
  /** Present on Grist builds that report page linking; absent on older hosts. */
  linking?: GristWidgetLinkingInfo
  [key: string]: unknown
}

/**
 * `TableOperations`-style record for `update`. Must include `id`; other fields are partial.
 * @see https://support.getgrist.com/code/interfaces/TableOperations.TableOperations/#update
 */
export type GristTableUpdateRecord = { id: number; fields: Record<string, unknown> }

/** Record for `create` (no id needed). */
export type GristTableNewRecord = { fields: Record<string, unknown> }

/** Record for `upsert`: `require` is the match key set, `fields` is what to write. */
export type GristTableUpsertRecord = {
  require: Record<string, unknown>
  fields?: Record<string, unknown>
}

/** Options accepted by `TableOperations.create / update`. */
export type GristTableOpOptions = {
  parseStrings?: boolean
}

/** Options accepted by `TableOperations.upsert`. */
export type GristTableUpsertOptions = GristTableOpOptions & {
  add?: boolean
  update?: boolean
  onMany?: "first" | "none" | "all"
  allowEmptyRequire?: boolean
}

export type GristMinimalRecord = { id: number }

/** Wraps `grist.getTable(...)` / `grist.selectedTable`. */
export type GristTableOperations = {
  getTableId: () => Promise<string>
  create: (
    records: GristTableNewRecord | GristTableNewRecord[],
    options?: GristTableOpOptions
  ) => Promise<GristMinimalRecord | GristMinimalRecord[]>
  update: (
    records: GristTableUpdateRecord | GristTableUpdateRecord[],
    options?: GristTableOpOptions
  ) => Promise<void>
  upsert: (
    records: GristTableUpsertRecord | GristTableUpsertRecord[],
    options?: GristTableUpsertOptions
  ) => Promise<void>
  destroy: (recordIds: number | number[]) => Promise<void>
}

/** Subset of `grist.docApi` from https://docs.getgrist.com/grist-plugin-api.js */
export type GristDocApi = {
  getDocName: () => Promise<string> | string
  listTables: () => Promise<string[]> | string[]
  fetchTable: (tableId: string) => Promise<Record<string, unknown[]>>
  applyUserActions: (
    actions: unknown[][],
    options?: GristApplyUserActionsOptions
  ) => Promise<unknown>
  /** Present when the widget requested sufficient access (e.g. full). */
  getAccessToken?: (options?: { readOnly?: boolean }) => Promise<{ token: string; baseUrl: string }>
  /** Current section's table data (often smaller than {@link fetchTable} for the whole table). */
  fetchSelectedTable?: (options?: GristFetchSelectedOptions) => Promise<Record<string, unknown[]>>
  /** Single row in the current section by numeric row id. */
  fetchSelectedRecord?: (rowId: number, options?: GristFetchSelectedOptions) => Promise<Record<string, unknown>>
}

// ---------------------------------------------------------------------------
// Replica document (canonical JSON) — see {@link GristReplicaDocument}
// ---------------------------------------------------------------------------
export type {
  GristDocumentMode,
  GristReplicaColumn,
  GristReplicaDocument,
  GristReplicaTable,
  GristReplicaRow,
} from "./replica-document"
