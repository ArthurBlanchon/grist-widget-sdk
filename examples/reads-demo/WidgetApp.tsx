import { useEffect, useState } from "react"

import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

export const GRIST_OPTIONS: UseGristOptions = {
  // fetchTableRows and listColumns read any table, which Grist only allows with full document access.
  requiredAccess: "full",
}

export const WIDGET_METADATA = {
  title: "Reads demo",
  description: "listTables, listColumns, fetchTableRows, fetchSelectedTable.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const { isReady, currentTableId, listTables, listColumns, fetchTableRows, fetchSelectedTable } = useGrist()
  const [summary, setSummary] = useState<string>("Loading…")

  useEffect(() => {
    if (!isReady) return
    let cancelled = false
    void (async () => {
      try {
        const tableIds = await listTables()
        const tableId = currentTableId ?? tableIds[0]
        if (!tableId) return
        const columns = (await listColumns(tableId)).map((c) => `${c.colId} (${c.type})`)
        const rows = await fetchTableRows(tableId)
        const section = await fetchSelectedTable()
        if (!cancelled) {
          setSummary(
            JSON.stringify(
              { tableIds, columns, rowCount: rows.length, firstRow: rows[0] ?? null, sectionRowIds: section.id },
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
  }, [isReady, currentTableId, listTables, listColumns, fetchTableRows, fetchSelectedTable])

  return (
    <pre className="max-h-svh overflow-auto p-4 text-xs">{summary}</pre>
  )
}
