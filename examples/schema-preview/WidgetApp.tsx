import { useGristSchema, useWidgetMetadata, type UseGristOptions } from "grist-widget-sdk"

export const GRIST_OPTIONS: UseGristOptions = {
  // The document's schema (_grist_Tables_column) is only readable with full access.
  requiredAccess: "full",
  suppressAlerts: ["section-not-linked"],
}

export const WIDGET_METADATA = {
  title: "Schema preview",
  description: "useGristSchema with replicaRowMode schema+samples for LLM context.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const schema = useGristSchema({ replicaRowMode: "schema+samples" })

  if (!schema.replicaDocument) {
    return <p className="p-4 text-sm text-muted-foreground">Loading schema…</p>
  }

  return (
    <pre className="max-h-svh overflow-auto p-4 text-xs">
      {JSON.stringify(schema.replicaDocument, null, 2)}
    </pre>
  )
}
