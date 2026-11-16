import { useCallback, useEffect, useMemo, useState } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Button } from "@shared/ui/button"
import { NativeSelect, NativeSelectOption } from "@shared/ui/native-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs"
import { Textarea } from "@shared/ui/textarea"
import { reportUrl } from "@shared/report-url"

import { messages } from "./messages"
import { around, HEAD, layout, markdown, mermaid, PAD, ROW, readSchema, type Schema } from "./schema"

export const widget = defineGristWidget({
  title: "Schema viewer",
  description: "An entity-relationship diagram of the document: its tables, their columns and the references between them, with the schema as text for an AI.",
  reportUrl: reportUrl(),
  // The document's columns and their types are in Grist's metadata tables, readable with full access.
  requiredAccess: "full",
  // It shows the whole document, whatever row is selected.
  suppressAlerts: ["section-not-linked"],
})

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const [schema, setSchema] = useState<Schema | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [focus, setFocus] = useState<string>("")
  const [fit, setFit] = useState(true)
  const [format, setFormat] = useState<"markdown" | "mermaid">("markdown")
  const [copy, setCopy] = useState<"copied" | "copyFailed" | null>(null)
  const [reads, setReads] = useState(0)

  const { listTables, listColumns } = w
  const ready = w.status === "ready"
  useEffect(() => {
    if (!ready) return
    let live = true
    readSchema({ listTables: () => listTables(), listColumns: (id) => listColumns(id) }).then(
      (s) => {
        if (!live) return
        setError(null)
        setSchema(s)
      },
      (err: unknown) => live && setError(err instanceof Error ? err.message : String(err)),
    )
    return () => {
      live = false
    }
  }, [ready, listTables, listColumns, reads])

  const shown = useMemo(() => (schema ? around(schema, schema.tables.some((x) => x.id === focus) ? focus : null) : null), [schema, focus])
  const drawn = useMemo(() => (shown ? layout(shown) : null), [shown])
  const text = shown ? (format === "markdown" ? markdown(shown) : mermaid(shown)) : ""

  const copyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopy("copied")
    } catch {
      setCopy("copyFailed")
    }
  }, [text])

  if (error) {
    return (
      <Alert variant="destructive" className="m-3">
        <AlertDescription>{t("failed", { error })}</AlertDescription>
      </Alert>
    )
  }
  if (!schema || !shown || !drawn) return <p className="m-auto flex h-svh items-center p-6 text-sm text-muted-foreground">{t("loading")}</p>
  if (!schema.tables.length) return <p className="m-auto flex h-svh items-center p-6 text-sm text-muted-foreground">{t("empty")}</p>

  return (
    <Tabs defaultValue="diagram" className="flex h-svh min-h-0 flex-col gap-2 bg-background p-3 text-foreground">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="diagram">{t("diagram")}</TabsTrigger>
          <TabsTrigger value="text">{t("text")}</TabsTrigger>
        </TabsList>
        <label htmlFor="focus" className="text-sm font-medium">
          {t("show")}
        </label>
        <div className="w-48">
          <NativeSelect id="focus" value={focus} onChange={(e) => setFocus(e.target.value)}>
            <NativeSelectOption value="">{t("all")}</NativeSelectOption>
            {schema.tables.map((x) => (
              <NativeSelectOption key={x.id} value={x.id}>
                {t("around", { table: x.id })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button size="sm" variant="outline" onClick={() => setReads((n) => n + 1)}>
          {t("refresh")}
        </Button>
        <p className="flex-1 text-right text-xs text-muted-foreground">{t("summary", { tables: shown.tables.length, links: shown.links.length })}</p>
      </div>

      <TabsContent value="diagram" className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex gap-1" role="group" aria-label={t("zoom")}>
          <Button size="sm" variant={fit ? "secondary" : "ghost"} aria-pressed={fit} onClick={() => setFit(true)}>
            {t("fit")}
          </Button>
          <Button size="sm" variant={fit ? "ghost" : "secondary"} aria-pressed={!fit} onClick={() => setFit(false)}>
            {t("actual")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40">
          <svg
            role="img"
            aria-label={t("picture")}
            viewBox={`0 0 ${drawn.width} ${drawn.height}`}
            width={fit ? "100%" : drawn.width}
            height={fit ? "100%" : drawn.height}
            className="font-sans text-xs"
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
              </marker>
            </defs>
            {drawn.paths.map((p) => (
              <g key={`${p.from}.${p.colId}`} data-link={`${p.from}.${p.colId}->${p.to}`} data-many={p.many || undefined}>
                <polyline
                  points={p.points.map((q) => `${q.x},${q.y}`).join(" ")}
                  className="fill-none stroke-muted-foreground"
                  strokeWidth={1.25}
                  strokeDasharray={p.many ? "5 3" : undefined}
                  markerEnd="url(#arrow)"
                />
                {p.points.length ? (
                  <text x={p.points[Math.floor(p.points.length / 2)]!.x} y={p.points[Math.floor(p.points.length / 2)]!.y - 4} textAnchor="middle" className="fill-muted-foreground">
                    {p.many ? `${p.label} (${t("many")})` : p.label}
                  </text>
                ) : null}
              </g>
            ))}
            {drawn.boxes.map((b) => (
              <g key={b.id} data-table={b.id} transform={`translate(${b.x},${b.y})`}>
                <rect width={b.width} height={b.height} rx={6} className="fill-card stroke-border" />
                <rect width={b.width} height={HEAD} rx={6} className="fill-secondary" />
                <text x={PAD} y={HEAD / 2 + 4} className="fill-foreground font-semibold">
                  {b.id}
                </text>
                {b.columns.map((c, i) => (
                  <g key={c.colId} data-column={c.colId} transform={`translate(0,${HEAD + i * ROW})`}>
                    <text x={PAD} y={ROW / 2 + 8} className={c.formula !== null ? "fill-muted-foreground italic" : "fill-foreground"}>
                      {c.label}
                      {c.formula !== null ? <title>{`${t("formula")}: ${c.formula}`}</title> : null}
                    </text>
                    <text x={b.width - PAD} y={ROW / 2 + 8} textAnchor="end" className="fill-muted-foreground">
                      {c.formula !== null ? `ƒ ${c.type}` : c.type}
                    </text>
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
      </TabsContent>

      <TabsContent value="text" className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="format" className="text-sm font-medium">
            {t("format")}
          </label>
          <div className="w-72">
            <NativeSelect id="format" value={format} onChange={(e) => setFormat(e.target.value as "markdown" | "mermaid")}>
              <NativeSelectOption value="markdown">{t("markdown")}</NativeSelectOption>
              <NativeSelectOption value="mermaid">{t("mermaid")}</NativeSelectOption>
            </NativeSelect>
          </div>
          <Button size="sm" onClick={() => void copyText()}>
            {t("copy")}
          </Button>
          {copy ? (
            <span role="status" className="text-xs text-muted-foreground">
              {t(copy)}
            </span>
          ) : null}
        </div>
        <Textarea readOnly aria-label={t("text")} value={text} className="min-h-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      </TabsContent>
    </Tabs>
  )
}
