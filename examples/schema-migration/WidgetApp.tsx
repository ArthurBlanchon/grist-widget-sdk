import { defineGristWidget } from "grist-widget-sdk"
import { gristAddVisibleColumnAction, gristRemoveColumnAction, gristRenameColumnAction } from "grist-widget-sdk/actions"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "Schema migration",
  description: "applyActions with user actions from grist-widget-sdk/actions: add, rename and remove columns.",
  requiredAccess: "full",
})

export function WidgetApp() {
  const w = widget.useGrist()

  async function runMigration() {
    const tableId = w.currentTableId
    if (!tableId) return
    await w.applyActions(
      [
        gristAddVisibleColumnAction(tableId, "Priority", { type: "Choice" }),
        gristAddVisibleColumnAction(tableId, "DueAt", { type: "Date" }),
        gristRenameColumnAction(tableId, "DueAt", "DueDate"),
      ],
      { desc: "Add Priority + DueAt; rename DueAt → DueDate" },
    )
  }

  async function rollback() {
    const tableId = w.currentTableId
    if (!tableId) return
    await w.applyActions(
      [
        gristRemoveColumnAction(tableId, "Priority"),
        gristRemoveColumnAction(tableId, "DueDate"),
      ],
      { desc: "Remove Priority + DueDate" },
    )
  }

  return (
    <div className="flex gap-2 p-4">
      <Button type="button" onClick={() => void runMigration()}>
        Run migration
      </Button>
      <Button type="button" variant="destructive" onClick={() => void rollback()}>
        Rollback
      </Button>
      {w.actionStatus === "running" ? (
        <p className="mt-2 text-xs text-muted-foreground">Applying…</p>
      ) : null}
      {w.actionError ? (
        <p className="mt-2 text-xs text-destructive">{w.actionError}</p>
      ) : null}
    </div>
  )
}
