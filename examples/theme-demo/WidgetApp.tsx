import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "read table",
  suppressAlerts: ["section-not-linked"],
}

export const WIDGET_METADATA = {
  title: "Theme",
  description: "Read w.theme from the host document.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

  return (
    <div className="p-4" data-theme={w.theme ?? "light"}>
      <p className="text-sm">Host theme: {w.theme ?? "light"}</p>
    </div>
  )
}
