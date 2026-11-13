import { defineGristWidget } from "grist-widget-sdk"

export const widget = defineGristWidget({
  title: "Theme",
  description: "Read w.theme from the host document.",
  requiredAccess: "read table",
  suppressAlerts: ["section-not-linked"],
})

export function WidgetApp() {
  const w = widget.useGrist()

  return (
    <div className="p-4" data-theme={w.theme ?? "light"}>
      <p className="text-sm">Host theme: {w.theme ?? "light"}</p>
    </div>
  )
}
