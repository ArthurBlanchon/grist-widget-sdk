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
  title: "Mark done",
  description: "Single-row write via table.update.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

  if (!w.columnMappingStatus.ok) {
    return <p className="p-4 text-sm">Map the Done column.</p>
  }
  if (w.mode !== "row" || !w.record) {
    return <p className="p-4 text-sm">Select a row.</p>
  }

  async function onClick() {
    await w.table.update({
      id: w.record!.id as number,
      fields: w.mapBack({ Done: true }),
    })
  }

  return (
    <div className="p-4">
      <Button type="button" onClick={() => void onClick()}>
        Mark done
      </Button>
    </div>
  )
}
