import { useEffect, useMemo, useRef, useState } from "react"

import { checkGristCell, defineGristWidget } from "grist-widget-sdk"

import { detectLocale, useT } from "@shared/i18n"
import { Button } from "@shared/ui/button"
import { Textarea } from "@shared/ui/textarea"

import { messages } from "./messages"
import { defaultTemplate, hasSection, page, placeholders, render, type Row } from "./template"

export const widget = defineGristWidget({
  title: "Document template",
  description: "One document per row (a quote, a certificate, a letter) from an HTML template with the columns as placeholders; or one for all rows. Print it, or save it as PDF.",
  requiredAccess: "full",
  // Options carry their version (ADR 0017): version 1, read as before.
  optionsVersion: 1,
  columns: [],
})

/** Columns Grist sends that are its own bookkeeping, not the person's data. */
const isHelper = (key: string) => key === "id" || key === "manualSort" || key.startsWith("gristHelper_")

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  const frame = useRef<HTMLIFrameElement>(null)
  const [draft, setDraft] = useState<string | null>(null)

  // The table's columns and their types: a Date cell arrives as seconds, and only its type says so.
  const [types, setTypes] = useState<ReadonlyMap<string, string | undefined> | null>(null)
  const { listColumns } = w
  const tableId = w.currentTableId
  useEffect(() => {
    if (!tableId) return
    let live = true
    listColumns(tableId).then(
      (cols) => live && setTypes(new Map(cols.filter((c) => !isHelper(c.colId)).map((c) => [c.colId, c.type]))),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [listColumns, tableId])

  const typed = useMemo(() => {
    const read = (r: Record<string, unknown> | null | undefined): Row | null => {
      if (!r) return null
      const out: Row = { id: r.id as number }
      for (const [k, v] of Object.entries(r)) {
        const check = checkGristCell(types?.get(k), v)
        out[k] = check.ok ? check.value : v
      }
      return out
    }
    return { row: read(w.record), rows: (w.records ?? []).map((r) => read(r)!) }
  }, [w.record, w.records, types])
  const { row, rows } = typed
  const columns = useMemo(() => {
    if (types) return new Set(types.keys())
    const keys = new Set<string>()
    for (const r of [row, ...rows]) if (r) for (const k of Object.keys(r)) if (!isHelper(k)) keys.add(k)
    return keys
  }, [types, row, rows])

  const saved = typeof w.widgetOptions?.template === "string" && w.widgetOptions.template.trim() ? w.widgetOptions.template : null
  const template = draft ?? saved ?? defaultTemplate([...columns])
  const editing = draft !== null
  const unknown = placeholders(template).filter((p) => !columns.has(p))
  const html = useMemo(() => render(template, row, rows, columns, locale), [template, row, rows, columns, locale])

  async function save() {
    if (draft === null) return
    await w.patchWidgetOptions({ template: draft })
    setDraft(null)
  }

  const needsRow = !row && !hasSection(template)

  return (
    <main className="flex h-svh min-h-0 flex-col gap-2 bg-background p-3 text-foreground">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-sm font-medium">{editing ? t("editing") : row ? t("rowTitle", { id: row.id }) : t("title")}</h1>
        {editing ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={draft === saved}>
              {t("save")}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setDraft(template)}>
              {t("edit")}
            </Button>
            <Button size="sm" onClick={() => frame.current?.contentWindow?.print()} disabled={needsRow}>
              {t("print")}
            </Button>
          </>
        )}
      </header>

      {editing ? (
        <section className="flex min-h-0 flex-col gap-1">
          <label htmlFor="template" className="text-sm font-medium">
            {t("templateLabel")}
          </label>
          <Textarea id="template" value={draft} onChange={(e) => setDraft(e.target.value)} className="max-h-64 font-mono text-xs" spellCheck={false} />
          <p className="text-xs text-muted-foreground">{t("help")}</p>
          <p className="text-xs text-muted-foreground">{t("columns", { list: [...columns].join(", ") || "—" })}</p>
        </section>
      ) : null}

      {unknown.length ? (
        <p role="status" className="text-xs text-destructive">
          {t("unknown", { list: unknown.join(", ") })}
        </p>
      ) : null}

      {needsRow ? (
        <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">{t("noRow")}</p>
      ) : (
        <iframe
          ref={frame}
          title={t("document")}
          // No allow-scripts: a script in the template never runs. Same origin, so Print can reach the frame.
          sandbox="allow-same-origin allow-modals"
          // eslint-disable-next-line no-restricted-syntax -- the owner's template is the page, sandboxed without scripts; cell values in it are escaped (template.ts)
          srcDoc={page(html)}
          className="min-h-0 w-full flex-1 rounded-lg border bg-background"
        />
      )}
    </main>
  )
}
