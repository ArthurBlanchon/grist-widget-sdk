import { defineGristWidget } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "Widget options",
  description: "Persist UI state with patchWidgetOptions / widgetOptions.",
  requiredAccess: "read table",
  suppressAlerts: ["section-not-linked"],
})

export function WidgetApp() {
  const w = widget.useGrist()
  const compact = w.widgetOptions?.compact === true

  return (
    <div className="p-4">
      <Button
        type="button"
        onClick={() => void w.patchWidgetOptions({ compact: !compact })}
      >
        {compact ? "Expand" : "Compact"}
      </Button>
    </div>
  )
}
