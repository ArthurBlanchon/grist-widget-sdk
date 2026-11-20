import { useMemo, useState, type DragEvent } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const widget = defineGristWidget({
  title: "Task board",
  description:
    "Mini Kanban board grouped by Status. Drag a card to update Status; click to focus the row in linked sections.",
  requiredAccess: "full",
  allowSelectBy: true,
  columns: [
    { name: "Title", type: "Text" },
    { name: "Status", type: "Text" },
    { name: "Priority", type: "Text", optional: true },
  ],
})

const DEFAULT_STATUSES = ["To do", "Doing", "Done"] as const

type Task = {
  id: number
  title: string
  status: string
  priority: string | null
}

function pickStatuses(rows: readonly Task[]): readonly string[] {
  const seen = new Set<string>(DEFAULT_STATUSES)
  for (const r of rows) {
    if (r.status && !seen.has(r.status)) seen.add(r.status)
  }
  return [...seen]
}

export function WidgetApp() {
  // mappedRecords: every row of the section under the declared names, typed
  // from the declaration (Title and Status are string | null). GristBoundary
  // asks for Title and Status until they are mapped.
  const w = widget.useGrist()

  const tasks = useMemo<Task[]>(
    () =>
      (w.mappedRecords ?? []).map((row) => ({
        id: row.id,
        title: row.Title || "(untitled)",
        status: row.Status || "To do",
        priority: row.Priority || null,
      })),
    [w.mappedRecords],
  )

  const statuses = useMemo(() => pickStatuses(tasks), [tasks])
  const [dragId, setDragId] = useState<number | null>(null)

  if (tasks.length === 0) {
    return (
      <Empty
        title="No rows to show"
        body="Add rows to the selected table — they will appear grouped by Status."
      />
    )
  }

  async function moveToStatus(task: Task, nextStatus: string) {
    if (task.status === nextStatus) return
    try {
      await w.updateRecord(task.id, { Status: nextStatus })
    } catch {
      // The card will snap back via the next `records` tick when the
      // optimistic update is rejected by Grist.
    }
  }

  return (
    <div className="flex h-svh min-h-0 flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-lg font-medium">Task board</h1>
        <span className="text-xs text-muted-foreground">
          {tasks.length} task{tasks.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
        {statuses.map((status) => {
          const inStatus = tasks.filter((c) => c.status === status)
          return (
            <section
              key={status}
              className="flex min-h-32 flex-col gap-2 rounded-lg border bg-muted/40 p-3"
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = "move"
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId == null) return
                const dragged = tasks.find((c) => c.id === dragId)
                setDragId(null)
                if (dragged) void moveToStatus(dragged, status)
              }}
            >
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{status}</h2>
                <Badge variant="secondary">{inStatus.length}</Badge>
              </header>
              <div className="flex flex-col gap-2">
                {inStatus.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isSelected={w.record?.id === task.id}
                    onClick={() => void w.setCursorPosition({ rowId: task.id })}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => setDragId(null)}
                  />
                ))}
                {inStatus.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tasks.</p>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function TaskCard({
  task,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  isSelected: boolean
  onClick: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void
}) {
  return (
    <Card
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={
        "cursor-grab transition-shadow hover:shadow-md " +
        (isSelected ? "ring-2 ring-primary" : "")
      }
    >
      <CardContent className="flex flex-col gap-1 p-3">
        <span className="text-sm font-medium">{task.title}</span>
        {task.priority ? (
          <Badge variant="outline" className="self-start">
            {task.priority}
          </Badge>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-svh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h2 className="font-medium">{title}</h2>
        {body ? (
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        ) : null}
      </div>
    </div>
  )
}
