import {
  useGrist,
  useWidgetMetadata,
  type GristMappedRow,
  type GristRowRecord,
  type UseGristOptions,
} from "grist-widget-sdk"

// `as const satisfies` keeps the column names and types literal, so
// GristMappedRow can type the mapped records from this one declaration.
export const GRIST_OPTIONS = {
  // Read-only is enough: each mapped cell is checked against the type declared here.
  requiredAccess: "read table",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Due", type: "Date", optional: true },
    { name: "Done", type: "Bool", optional: true },
  ],
  suppressAlerts: ["section-not-linked"],
} as const satisfies UseGristOptions

type Task = GristMappedRow<typeof GRIST_OPTIONS>

export const WIDGET_METADATA = {
  title: "Typed reads",
  description: "Mapped records typed and checked from GRIST_OPTIONS, with read-only access.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const { mappedRecords, cellIssues } = useGrist<GristRowRecord, Task>()

  return (
    <div className="grid gap-3 p-4 text-sm">
      <ul className="grid gap-1">
        {(mappedRecords ?? []).map((task) => (
          <li key={task.id}>
            {task.Done ? "✓" : "○"} {task.Title || "(untitled)"}
            {task.Due ? <span className="text-muted-foreground"> — due {task.Due.toLocaleDateString()}</span> : null}
          </li>
        ))}
      </ul>
      {cellIssues.length > 0 ? (
        <ul className="grid gap-1 text-xs text-destructive">
          {cellIssues.map((issue) => (
            <li key={`${issue.rowId}:${issue.column}`}>
              Row {issue.rowId}, {issue.column}: {issue.message} ({JSON.stringify(issue.value)})
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Every mapped cell matches its declared type.</p>
      )}
    </div>
  )
}
