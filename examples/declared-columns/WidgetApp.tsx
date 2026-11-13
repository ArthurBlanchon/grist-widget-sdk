import {
  useGrist,
  useWidgetMetadata,
  type UseGristOptions,
} from "grist-widget-sdk"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
  columns: [
    { name: "Title", type: "Text" },
    { name: "Done", type: "Bool" },
    { name: "Tags", type: "ChoiceList", allowMultiple: true, optional: true },
  ],
}

export const WIDGET_METADATA = {
  title: "Declared columns",
  description:
    "Shows GRIST_OPTIONS column declarations and mappedRecord after the user maps columns.",
} as const

export function WidgetApp() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist()

  if (!w.columnMappingStatus.ok) {
    return (
      <p className="p-4 text-sm">
        Map columns in the widget panel:{" "}
        {w.columnMappingStatus.missing.join(", ")}
      </p>
    )
  }

  if (w.mode === "empty") return <p className="p-4 text-sm">Select a row.</p>

  return (
    <pre className="overflow-auto p-4 text-xs">
      {JSON.stringify(w.mappedRecord, null, 2)}
    </pre>
  )
}
