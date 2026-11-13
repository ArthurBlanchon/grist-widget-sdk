/**
 * Grist `docApi.applyUserActions` payloads are arrays of user-action tuples.
 * @see https://support.getgrist.com/code/interfaces/grist_plugin_api.GristDocAPI/#applyuseractions
 */

export type GristUserActionTuple = unknown[]

/** `["UpdateRecord", tableId, rowId, { col: value, ... }]` */
export function gristUpdateRecordAction(
  tableId: string,
  rowId: number,
  patch: Record<string, unknown>
): GristUserActionTuple {
  return ["UpdateRecord", tableId, rowId, patch]
}

/** `["AddRecord", tableId, null, { col: value, ... }]` */
export function gristAddRecordAction(tableId: string, values: Record<string, unknown>): GristUserActionTuple {
  return ["AddRecord", tableId, null, values]
}

/** `["RemoveRecord", tableId, rowId]` */
export function gristRemoveRecordAction(tableId: string, rowId: number): GristUserActionTuple {
  return ["RemoveRecord", tableId, rowId]
}

/** `["AddColumn", tableId, colId, colInfo]` — `colInfo` shape depends on Grist version / column type. */
export function gristBulkUpdateRecordAction(
  tableId: string,
  rowIds: number[],
  columnarPatch: Record<string, unknown[]>
): GristUserActionTuple {
  return ["BulkUpdateRecord", tableId, rowIds, columnarPatch]
}

/**
 * `["BulkAddRecord", tableId, rowIds | nullArray, { col: value[], ... }]`.
 * Pass `null` (or omit) for `rowIds` to let Grist allocate ids; in user-action
 * format Grist expects an array of nulls of the same length as the value arrays.
 */
export function gristBulkAddRecordAction(
  tableId: string,
  values: Record<string, unknown[]>,
  rowIds?: Array<number | null>
): GristUserActionTuple {
  const length = inferBulkLength(values)
  const ids = rowIds ?? new Array<number | null>(length).fill(null)
  return ["BulkAddRecord", tableId, ids, values]
}

/** `["BulkRemoveRecord", tableId, rowIds]` */
export function gristBulkRemoveRecordAction(tableId: string, rowIds: number[]): GristUserActionTuple {
  return ["BulkRemoveRecord", tableId, rowIds]
}

/** `["AddColumn", tableId, colId, colInfo]` — `colInfo` shape depends on Grist version / column type. */
export function gristAddColumnAction(tableId: string, colId: string, colInfo: Record<string, unknown>): GristUserActionTuple {
  return ["AddColumn", tableId, colId, colInfo]
}

/** `["AddVisibleColumn", tableId, colId, colInfo]` — like `AddColumn` but also adds the column to the current view section. */
export function gristAddVisibleColumnAction(tableId: string, colId: string, colInfo: Record<string, unknown>): GristUserActionTuple {
  return ["AddVisibleColumn", tableId, colId, colInfo]
}

/** `["RenameColumn", tableId, colId, newColId]` */
export function gristRenameColumnAction(tableId: string, colId: string, newColId: string): GristUserActionTuple {
  return ["RenameColumn", tableId, colId, newColId]
}

/** `["ModifyColumn", tableId, colId, colInfo]` */
export function gristModifyColumnAction(tableId: string, colId: string, colInfo: Record<string, unknown>): GristUserActionTuple {
  return ["ModifyColumn", tableId, colId, colInfo]
}

/** `["RemoveColumn", tableId, colId]` */
export function gristRemoveColumnAction(tableId: string, colId: string): GristUserActionTuple {
  return ["RemoveColumn", tableId, colId]
}

/** `["AddTable", tableId, tableInfo]` */
export function gristAddTableAction(tableId: string, tableInfo: Record<string, unknown>): GristUserActionTuple {
  return ["AddTable", tableId, tableInfo]
}

function inferBulkLength(values: Record<string, unknown[]>): number {
  for (const arr of Object.values(values)) if (Array.isArray(arr)) return arr.length
  return 0
}
