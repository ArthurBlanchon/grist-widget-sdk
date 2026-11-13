import { useState } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "REST fetch",
  description: "fetchWithAuth against the Grist REST API.",
  requiredAccess: "full",
  suppressAlerts: ["section-not-linked"],
})

export function WidgetApp() {
  const w = widget.useGrist()
  const [body, setBody] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadTables() {
    setError(null)
    try {
      const res = await w.fetchWithAuth("/tables")
      const json = await res.json()
      setBody(JSON.stringify(json, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <Button type="button" onClick={() => void loadTables()}>
        GET /tables
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {body ? (
        <pre className="max-h-64 overflow-auto text-xs">{body}</pre>
      ) : null}
    </div>
  )
}
