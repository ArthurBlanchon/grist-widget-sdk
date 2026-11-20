import { useEffect, useState } from "react"

import { defineGristWidget } from "grist-widget-sdk"

export const widget = defineGristWidget({
  title: "Reads demo",
  description: "listTables, listColumns and fetchRows: the section's rows, then any table's.",
  // fetchRows(tableId) and listColumns read any table, which Grist only allows with full document access.
  requiredAccess: "full",
})

export function WidgetApp() {
  const { status, currentTableId, listTables, listColumns, fetchRows } = widget.useGrist()
  const [summary, setSummary] = useState<string>("Loading…")

  useEffect(() => {
    if (status !== "ready") return
    let cancelled = false
    void (async () => {
      try {
        const tableIds = await listTables()
        const tableId = currentTableId ?? tableIds[0]
        if (!tableId) return
        const columns = (await listColumns(tableId)).map((c) => `${c.colId} (${c.type})`)
        const rows = await fetchRows(tableId)
        const section = await fetchRows()
        if (!cancelled) {
          setSummary(
            JSON.stringify(
              { tableIds, columns, rowCount: rows.length, firstRow: rows[0] ?? null, sectionRowIds: section.map((r) => r.id) },
              null,
              2,
            ),
          )
        }
      } catch (err) {
        if (!cancelled) setSummary(`Read failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, currentTableId, listTables, listColumns, fetchRows])

  return (
    <pre className="max-h-svh overflow-auto p-4 text-xs">{summary}</pre>
  )
}
