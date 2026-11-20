import { defineGristWidget } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "Mark done",
  description: "Single-row write: updateRecord under the declared column name.",
  requiredAccess: "full",
  columns: [{ name: "Done", type: "Bool" }],
})

export function WidgetApp() {
  const w = widget.useGrist()

  if (!w.mappedRecord) {
    return <p className="p-4 text-sm">Select a row.</p>
  }

  return (
    <div className="p-4">
      <Button type="button" disabled={w.mappedRecord.Done === true} onClick={() => void w.updateRecord({ Done: true })}>
        Mark done
      </Button>
    </div>
  )
}
