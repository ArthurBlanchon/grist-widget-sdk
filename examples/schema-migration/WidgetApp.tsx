import {
  gristAddVisibleColumnAction,
  gristRemoveColumnAction,
  gristRenameColumnAction,
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
}

export const WIDGET_METADATA = {
  title: "Schema migration",
  description:
    "applyActions with gristAddVisibleColumnAction, gristRenameColumnAction, and gristRemoveColumnAction.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

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
