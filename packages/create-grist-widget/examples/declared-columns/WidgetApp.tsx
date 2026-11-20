import { defineGristWidget } from "grist-widget-sdk"

export const widget = defineGristWidget({
  title: "Declared columns",
  description: "Shows the widget's declared columns and mappedRecord once the user maps them.",
  requiredAccess: "full",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Done", type: "Bool" },
    { name: "Tags", type: "ChoiceList", allowMultiple: true, optional: true },
  ],
})

export function WidgetApp() {
  // GristBoundary (mountGristWidget renders it) asks for Title and Done
  // until they are mapped; Tags is optional and may stay unmapped.
  const w = widget.useGrist()

  if (w.mode === "empty") return <p className="p-4 text-sm">Select a row.</p>

  return (
    <pre className="overflow-auto p-4 text-xs">
      {JSON.stringify(w.mappedRecord, null, 2)}
    </pre>
  )
}
