import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
  columns: [{ name: "Done", type: "Bool" }],
}

export const WIDGET_METADATA = {
  title: "Bulk mark done",
  description: "Bulk table.update with an array of row patches.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

  if (!w.columnMappingStatus.ok) {
    return <p className="p-4 text-sm">Map the Done column.</p>
  }

  async function markAll() {
    if (!w.records) return
    const updates = w.records.map((row) => ({
      id: row.id as number,
      fields: w.mapBack({ Done: true }),
    }))
    await w.table.update(updates)
  }

  return (
    <div className="p-4">
      <Button type="button" onClick={() => void markAll()}>
        Mark all rows done
      </Button>
    </div>
  )
}
