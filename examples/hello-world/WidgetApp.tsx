import { defineGristWidget } from "grist-widget-sdk"

export const widget = defineGristWidget({
  requiredAccess: "read table",
})

export function WidgetApp() {
  const w = widget.useGrist()

  if (w.mode === "empty") return <p>Select a row.</p>
  if (w.mode === "new-row") return <p>New row flow</p>
  return <p>Selected row #{w.record?.id}</p>
}
