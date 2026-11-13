import { useEffect, useRef, useState } from "react"

import {
  useGristContext,
  useGristSchema,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

import { GristDataSheetGrid } from "./GristDataSheetGrid"
import { GristSchemaToolbar } from "./GristSchemaToolbar"

function downloadReplicaJson(label: string, json: string) {
  const safe = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()
  const blob = new Blob([json], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `replica-${safe}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export const GRIST_OPTIONS: UseGristOptions = {
  /** Required so `table.update` / `applyUserActions` succeed. */
  requiredAccess: "full",
  /** Needed so `setCursorPos` / linked selection can drive host row focus. */
  allowSelectBy: true,
}

export const WIDGET_METADATA = {
  title: "Spreadsheet grid",
  description:
    "Selected Grist section rendered as a fully-synced, editable spreadsheet via react-datasheet-grid, plus a schema toolbar and replica-document export.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)

  // Hoist the schema fetch so the grid + toolbar share it (single
  // `_grist_Tables_column` round-trip per reload).
  const w = useGristContext()
  const schema = useGristSchema({
    tableId: w.currentTableId ?? undefined,
    requiredAccess: "full",
    excludeManualSort: true,
  })

  const [exporting, setExporting] = useState<string | null>(null)
  const [showSchemaToolbar, setShowSchemaToolbar] = useState(false)
  const gridHostRef = useRef<HTMLDivElement | null>(null)
  const [gridHeight, setGridHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const host = gridHostRef.current
    if (!host) return
    const update = () => {
      const next = Math.floor(host.getBoundingClientRect().height)
      if (next > 0) setGridHeight(next)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  // The replica document useGristSchema already loaded (schema + sample rows).
  function exportReplica(key: string, includeRows: "none" | "samples") {
    const json = schema.getDocumentJson({ includeRows })
    if (!json) return
    setExporting(key)
    try {
      downloadReplicaJson(key, json)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="flex h-svh min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!w.isReady || exporting !== null}
          onClick={() => exportReplica("schema-only", "none")}
        >
          {exporting === "schema-only" ? "…" : "Export schema"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!w.isReady || exporting !== null}
          onClick={() => exportReplica("schema-samples", "samples")}
        >
          {exporting === "schema-samples" ? "…" : "Export schema + samples"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSchemaToolbar((v) => !v)}
        >
          {showSchemaToolbar ? "Hide schema toolbar" : "Show schema toolbar"}
        </Button>
      </div>
      {showSchemaToolbar ? <GristSchemaToolbar schema={schema} /> : null}
      <div ref={gridHostRef} className="min-h-0 flex-1 overflow-hidden">
        <GristDataSheetGrid schema={schema} autoAddRow height={gridHeight} />
      </div>
    </div>
  )
}
