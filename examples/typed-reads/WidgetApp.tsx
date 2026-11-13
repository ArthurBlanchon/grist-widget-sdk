import { defineGristWidget } from "grist-widget-sdk"

// The declaration types the mapped records: each task is
// { id; Title: string | null; Due: Date | null; Done: boolean | null }, no generics.
export const widget = defineGristWidget({
  title: "Typed reads",
  description: "Mapped records typed and checked from the widget's declaration, with read-only access.",
  // Read-only is enough: each mapped cell is checked against the type declared here.
  requiredAccess: "read table",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Due", type: "Date", optional: true },
    { name: "Done", type: "Bool", optional: true },
  ],
  suppressAlerts: ["section-not-linked"],
})

export function WidgetApp() {
  const { mappedRecords, cellIssues } = widget.useGrist()

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
