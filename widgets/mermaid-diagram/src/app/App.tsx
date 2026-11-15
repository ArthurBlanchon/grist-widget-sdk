import { useEffect, useRef, useState } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Button } from "@shared/ui/button"

import { messages } from "./messages"
import { renderDiagram, svgNode } from "./render"
import { flowchart } from "./source"

export const widget = defineGristWidget({
  title: "Mermaid diagram",
  description: "A Mermaid diagram written in the selected row's cell, or a flowchart drawn from the rows' From and To columns.",
  requiredAccess: "read table",
  columns: [
    { name: "Diagram", type: "Text", optional: true, title: "Mermaid source (cell mode)" },
    { name: "From", optional: true, title: "From (rows mode: an arrow per row)" },
    { name: "To", optional: true, title: "To" },
    { name: "Label", optional: true, title: "Arrow label" },
  ],
})

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const holder = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [theme, setTheme] = useState(() => document.documentElement.className)

  const rowsMode = Boolean(w.mappings.From && w.mappings.To)
  const source = rowsMode ? flowchart(w.mappedRecords ?? []).source : (w.mappedRecord?.Diagram ?? "").trim()

  // Grist's light and dark themes change the colours the diagram is drawn with.
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(document.documentElement.className))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!source) return
    let live = true
    renderDiagram(source).then(
      (out) => {
        if (!live) return
        setError(null)
        setSvg(out)
      },
      (err: unknown) => {
        if (!live) return
        setSvg(null)
        setError(err instanceof Error ? err.message : String(err))
      },
    )
    return () => {
      live = false
    }
  }, [source, theme])

  useEffect(() => {
    const node = svg ? svgNode(svg) : null
    holder.current?.replaceChildren(...(node ? [node] : []))
  }, [svg])

  function download() {
    if (!svg) return
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "diagram.svg"
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!source) {
    const empty = rowsMode ? t("noRows") : w.mappings.Diagram ? (w.record ? t("emptyCell") : t("noRow")) : t("howTo")
    return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{empty}</p>
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-2 bg-background p-3 text-foreground">
      <header className="flex items-center gap-2">
        <p className="flex-1 text-xs text-muted-foreground">{rowsMode ? t("fromRows") : t("fromCell")}</p>
        <Button size="sm" variant="outline" disabled={!svg} onClick={download}>
          {t("download")}
        </Button>
      </header>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t("syntax", { error })}</AlertDescription>
        </Alert>
      ) : null}
      <div ref={holder} role="img" aria-label={t("diagram")} className="flex min-h-0 flex-1 items-center justify-center overflow-auto [&_svg]:h-auto [&_svg]:max-w-full" />
    </main>
  )
}
