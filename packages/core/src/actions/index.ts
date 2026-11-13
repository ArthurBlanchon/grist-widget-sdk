/**
 * grist-widget-sdk/actions: user actions for `useGrist().applyActions()`,
 * Grist's own tuples for what the table API doesn't cover: schema changes
 * (tables, columns) and batches of changes applied as one undoable step.
 *
 * ```ts
 * import { gristAddColumnAction, gristRenameColumnAction } from "grist-widget-sdk/actions"
 *
 * await w.applyActions([
 *   gristAddColumnAction("Tasks", "Due", { type: "Date" }),
 *   gristRenameColumnAction("Tasks", "Owner", "Assignee"),
 * ])
 * ```
 *
 * Record changes in the widget's table are simpler with `w.updateRecord()`,
 * `w.addRecord()` or `w.table`.
 */

export {
  gristAddColumnAction,
  gristAddRecordAction,
  gristAddTableAction,
  gristAddVisibleColumnAction,
  gristBulkAddRecordAction,
  gristBulkRemoveRecordAction,
  gristBulkUpdateRecordAction,
  gristModifyColumnAction,
  gristRemoveColumnAction,
  gristRemoveRecordAction,
  gristRenameColumnAction,
  gristUpdateRecordAction,
  type GristUserActionTuple,
} from "../sdk/helpers/grist-user-actions"
