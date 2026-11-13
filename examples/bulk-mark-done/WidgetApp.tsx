import { defineGristWidget } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "Bulk mark done",
  description: "Bulk table.update with an array of row patches, each mapped back from the declared name.",
  requiredAccess: "full",
  columns: [{ name: "Done", type: "Bool" }],
})

export function WidgetApp() {
  const w = widget.useGrist()

  async function markAll() {
    if (!w.records) return
    // One write for every row of the section: table.update takes an array.
    const fields = w.mapBack({ Done: true })
    await w.table.update(w.records.map((row) => ({ id: row.id, fields })))
  }

  return (
    <div className="p-4">
      <Button type="button" onClick={() => void markAll()}>
        Mark all rows done
      </Button>
    </div>
  )
}
