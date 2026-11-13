import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "read table",
  suppressAlerts: ["section-not-linked"],
}

export const WIDGET_METADATA = {
  title: "Widget options",
  description: "Persist UI state with patchWidgetOptions / widgetOptions.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()
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
