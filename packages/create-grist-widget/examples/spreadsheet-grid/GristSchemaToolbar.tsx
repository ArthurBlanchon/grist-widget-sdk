import { useState } from "react"
import { Plus, RefreshCw, X } from "lucide-react"

import { useGrist, useGristSchema, type UseGristSchemaResult } from "grist-widget-sdk"
import {
  gristModifyColumnAction,
  gristRemoveColumnAction,
  gristRenameColumnAction,
  type GristUserActionTuple,
} from "grist-widget-sdk/actions"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import {
  GRIST_TOOLBAR_COLUMN_TYPES,
  type GristToolbarColumnType,
} from "./grist-rdg-columns"

export type GristSchemaToolbarProps = {
  /**
   * Optional pre-fetched schema. Shared with `<GristDataSheetGrid>` so we
   * don't issue duplicate `_grist_Tables_column` reads.
   */
  schema?: UseGristSchemaResult
  /** Per-action toggles. All enabled by default. */
  enable?: {
    add?: boolean
    rename?: boolean
    retype?: boolean
    remove?: boolean
  }
  className?: string
}

/**
 * Renders inline controls for column add / rename / type-change / remove
 * against the currently-selected Grist table.
 *
 * Writes use `useGrist().applyActions(...)` with the SDK's exported action
 * builders. Schema is reloaded after each mutation so the chip list reflects
 * the new state immediately.
 */
export function GristSchemaToolbar({
  schema: schemaProp,
  enable,
  className,
}: GristSchemaToolbarProps) {
  const w = useGrist()
  const internalSchema = useGristSchema({
    tableId: schemaProp ? undefined : (w.currentTableId ?? undefined),
  })
  const schema = schemaProp ?? internalSchema

  const [adding, setAdding] = useState(false)
  const [newColId, setNewColId] = useState("")
  const [newType, setNewType] = useState<GristToolbarColumnType>("Text")

  const tableId = w.currentTableId
  const can = {
    add: enable?.add ?? true,
    rename: enable?.rename ?? true,
    retype: enable?.retype ?? true,
    remove: enable?.remove ?? true,
  }

  if (!tableId) return null
  if (!schema.table) {
    return (
      <p className={className ?? "text-xs text-muted-foreground"}>
        Loading schema…
      </p>
    )
  }

  const cols = Object.entries(schema.table.columns ?? {})

  const handleAdd = async () => {
    const id = newColId.trim()
    if (!id) return
    try {
      // `AddVisibleColumn` (instead of plain `AddColumn`) also adds the new
      // column to the *active* section's view fields, so Grist users see it
      // straight away in the table view they're working with. There's no
      // dedicated builder for this in the SDK; we hand-write the tuple.
      const action: GristUserActionTuple = [
        "AddVisibleColumn",
        tableId,
        id,
        { type: newType, label: id },
      ]
      await w.applyActions([action])
      await schema.reload()
      setAdding(false)
      setNewColId("")
      setNewType("Text")
    } catch {
      // Surfaced by the SDK's alerts (mountGristWidget).
    }
  }

  const handleRename = async (oldId: string, rawNewId: string) => {
    const newId = rawNewId.trim()
    if (!newId || newId === oldId) return
    try {
      await w.applyActions([gristRenameColumnAction(tableId, oldId, newId)])
      await schema.reload()
    } catch {
      /* surfaced by the SDK's alerts */
    }
  }

  const handleType = async (colId: string, type: string) => {
    try {
      await w.applyActions([gristModifyColumnAction(tableId, colId, { type })])
      await schema.reload()
    } catch {
      /* surfaced by the SDK's alerts */
    }
  }

  const handleDelete = async (colId: string) => {
    if (!window.confirm(`Remove column "${colId}"?`)) return
    try {
      await w.applyActions([gristRemoveColumnAction(tableId, colId)])
      await schema.reload()
    } catch {
      /* surfaced by the SDK's alerts */
    }
  }

  const isPending = w.actionStatus === "running"

  return (
    <div className={className ?? "flex flex-wrap items-center gap-1.5"}>
      <span className="mr-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Columns
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={isPending || schema.loading}
        onClick={() => void schema.reload()}
        aria-label="Reload schema"
        title="Reload schema"
      >
        <RefreshCw
          className={schema.loading ? "size-3 animate-spin" : "size-3"}
        />
      </Button>

      {cols.map(([colId, col]) => {
        const currentType =
          (typeof col.type === "string" ? col.type : "Text") || "Text"
        return (
          <div
            key={colId}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs"
          >
            <Input
              key={colId}
              defaultValue={colId}
              disabled={!can.rename || isPending}
              className="h-6 w-24 px-1.5 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur()
                } else if (e.key === "Escape") {
                  e.currentTarget.value = colId
                  e.currentTarget.blur()
                }
              }}
              onBlur={(e) => {
                if (!can.rename) return
                void handleRename(colId, e.currentTarget.value)
              }}
              aria-label={`Rename ${colId}`}
            />
            <select
              value={
                GRIST_TOOLBAR_COLUMN_TYPES.includes(
                  currentType as GristToolbarColumnType
                )
                  ? (currentType as GristToolbarColumnType)
                  : "Any"
              }
              disabled={!can.retype || isPending}
              onChange={(e) => void handleType(colId, e.target.value)}
              className="h-6 rounded border border-input bg-background px-1 text-xs"
              aria-label={`Type of ${colId}`}
            >
              {GRIST_TOOLBAR_COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {/* Show the actual type if it's not in the toolbar's curated list (e.g. Ref:Foo). */}
              {!GRIST_TOOLBAR_COLUMN_TYPES.includes(
                currentType as GristToolbarColumnType
              ) ? (
                <option value={currentType}>{currentType}</option>
              ) : null}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!can.remove || isPending}
              onClick={() => void handleDelete(colId)}
              aria-label={`Remove ${colId}`}
            >
              <X className="size-3" />
            </Button>
          </div>
        )
      })}

      {can.add ? (
        adding ? (
          <div className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs">
            <Input
              autoFocus
              placeholder="colId"
              value={newColId}
              disabled={isPending}
              className="h-6 w-24 px-1.5 text-xs"
              onChange={(e) => setNewColId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleAdd()
                } else if (e.key === "Escape") {
                  setAdding(false)
                  setNewColId("")
                }
              }}
            />
            <select
              value={newType}
              disabled={isPending}
              onChange={(e) =>
                setNewType(e.target.value as GristToolbarColumnType)
              }
              className="h-6 rounded border border-input bg-background px-1 text-xs"
              aria-label="New column type"
            >
              {GRIST_TOOLBAR_COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="xs"
              disabled={isPending || !newColId.trim()}
              onClick={() => void handleAdd()}
            >
              Add
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setAdding(false)
                setNewColId("")
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setAdding(true)}
            disabled={isPending}
          >
            <Plus className="size-3" />
            Column
          </Button>
        )
      ) : null}
    </div>
  )
}
