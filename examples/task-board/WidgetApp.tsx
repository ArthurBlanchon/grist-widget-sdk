import { useMemo, useState, type DragEvent } from "react"

import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
  allowSelectBy: true,
  columns: [
    { name: "Title", type: "Text" },
    { name: "Status", type: "Text" },
    { name: "Priority", type: "Text", optional: true },
  ],
}

export const WIDGET_METADATA = {
  title: "Task board",
  description:
    "Mini Kanban board grouped by Status. Drag a card to update Status; click to focus the row in linked sections.",
} as const

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

function asString(value: unknown): string {
  if (typeof value === "string") return value
  if (value == null) return ""
  return String(value)
}

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

  // Resolve the physical column ids once per render. We can't call mapBack on
  // every row record because mapBack is for a single record write; here we
  // want to project the rows from raw `records` into a typed shape.
  const titleColId = w.resolveMappedColumnId("Title")
  const statusColId = w.resolveMappedColumnId("Status")
  const priorityColId = w.resolveMappedColumnId("Priority")

  const tasks = useMemo<Task[]>(() => {
    if (
      !w.columnMappingStatus.ok ||
      !titleColId ||
      !statusColId ||
      !w.records
    ) {
      return []
    }
    return w.records.map((row) => {
      const status = asString(row[statusColId])
      const priority = priorityColId ? asString(row[priorityColId]) : ""
      return {
        id: row.id as number,
        title: asString(row[titleColId]) || "(untitled)",
        status: status || "To do",
        priority: priority || null,
      }
    })
  }, [
    w.records,
    w.columnMappingStatus,
    titleColId,
    statusColId,
    priorityColId,
  ])

  const statuses = useMemo(() => pickStatuses(tasks), [tasks])
  const [dragId, setDragId] = useState<number | null>(null)

  if (w.status === "booting") {
    return <Empty title="Connecting to Grist…" body="" />
  }

  if (!w.columnMappingStatus.ok) {
    return (
      <Empty
        title="Missing column mappings"
        body="Open the widget configuration panel and map the columns: Title (Text), Status (Text), Priority (Text, optional)."
      />
    )
  }

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
      await w.table.update({
        id: task.id,
        fields: w.mapBack({ Status: nextStatus }),
      })
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
