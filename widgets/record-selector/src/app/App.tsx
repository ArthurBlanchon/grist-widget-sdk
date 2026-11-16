import { useMemo, useState, type KeyboardEvent } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Input } from "@shared/ui/input"
import { reportUrl } from "@shared/report-url"

import { messages } from "./messages"
import { display, matches, normalize } from "./search"

export const widget = defineGristWidget({
  title: "Record selector",
  description: "Find a row by typing part of its name, and pick it: linked widgets follow.",
  reportUrl: reportUrl(),
  requiredAccess: "read table",
  allowSelectBy: true,
  columns: [
    { name: "Title", title: "Title" },
    { name: "Subtitle", optional: true, title: "Subtitle" },
    { name: "Search", optional: true, allowMultiple: true, title: "More columns to search" },
  ],
})

/** The most results listed at once: a longer list is a search to narrow. */
export const MAX_RESULTS = 200

type Result = { id: number; title: string; subtitle: string; fields: unknown[] }

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)

  const rows = useMemo<Result[]>(
    () =>
      (w.mappedRecords ?? []).map((row) => ({
        id: row.id,
        title: display(row.Title).trim() || t("untitled"),
        subtitle: display(row.Subtitle),
        fields: [row.Title, row.Subtitle, ...(row.Search ?? [])],
      })),
    [w.mappedRecords, t],
  )
  const q = normalize(query.trim())
  const matching = useMemo(() => rows.filter((r) => matches(q, r.fields)), [rows, q])
  const shown = matching.slice(0, MAX_RESULTS)
  const current = Math.min(active, Math.max(shown.length - 1, 0))

  const pick = (row: Result) => void w.setCursorPosition({ rowId: row.id })

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const delta = e.key === "ArrowDown" ? 1 : -1
      setActive(Math.min(Math.max(current + delta, 0), Math.max(shown.length - 1, 0)))
    } else if (e.key === "Enter" && shown[current]) {
      e.preventDefault()
      pick(shown[current])
    }
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-2 bg-background p-3 text-foreground">
      <Input
        type="search"
        role="combobox"
        aria-label={t("search")}
        aria-controls="results"
        aria-expanded={shown.length > 0}
        aria-activedescendant={shown[current] ? `result-${shown[current].id}` : undefined}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
        }}
        onKeyDown={onKey}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {q ? t("matches", { n: matching.length, total: rows.length }) : t("count", { n: rows.length })}
      </p>

      {rows.length === 0 ? (
        <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noMatch", { q: query.trim() })}</p>
      ) : (
        <ul id="results" role="listbox" aria-label={t("results")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {shown.map((row, i) => (
            <li
              key={row.id}
              id={`result-${row.id}`}
              role="option"
              aria-selected={i === current}
              aria-current={w.record?.id === row.id ? "true" : undefined}
              data-current={w.record?.id === row.id ? "" : undefined}
              onClick={() => {
                setActive(i)
                pick(row)
              }}
              onMouseEnter={() => setActive(i)}
              className="cursor-pointer rounded-md px-3 py-2 aria-selected:bg-accent data-current:font-semibold data-current:ring-1 data-current:ring-primary"
            >
              <span className="block truncate text-sm">{row.title}</span>
              {row.subtitle ? <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {matching.length > MAX_RESULTS ? (
        <p className="text-xs text-muted-foreground">{t("capped", { shown: MAX_RESULTS, n: matching.length })}</p>
      ) : null}
    </main>
  )
}
