// The page ref-read.mjs embeds in a real Grist: a widget declaring pure
// reference columns, which shows what it reads for the selected row.
import { defineGristWidget, type GristColumnToMap } from "grist-widget-sdk"
import { mountGristWidget } from "grist-widget-sdk/app"

import declared from "./widget.json"

export const widget = defineGristWidget({
  title: declared.title,
  requiredAccess: "read table",
  columns: declared.columns as GristColumnToMap[],
})

function App() {
  const w = widget.useGrist()
  const r = w.mappedRecord as Record<string, unknown> | null
  return <pre id="out">{r ? JSON.stringify({ Owner: r.Owner, Helpers: r.Helpers, Code: r.Code }) : ""}</pre>
}

mountGristWidget({ widget, default: App })
