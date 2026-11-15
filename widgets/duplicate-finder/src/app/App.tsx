import { useEffect, useMemo, useState } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Button } from "@shared/ui/button"
import { NativeSelect, NativeSelectOption } from "@shared/ui/native-select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shared/ui/tabs"

import { defaultKeep, findGroups, type Mode, type Row } from "./match"
import { columnReport, planMerge, type ColumnReport, type Plan, type Reader } from "./merge"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Duplicate finder",
  description: "Find the rows that are the same on key columns, exactly or approximately, and merge them; with a data-quality report per column.",
  requiredAccess: "full",
  columns: [{ name: "Keys", allowMultiple: true, title: "Columns that identify a row" }],
})

const show = (v: unknown, blank: string) => (v === null || v === undefined || v === "" ? blank : Array.isArray(v) ? v.filter((x) => x !== "L").join(", ") : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const keys = useMemo(() => (Array.isArray(w.mappings.Keys) ? w.mappings.Keys : typeof w.mappings.Keys === "string" ? [w.mappings.Keys] : []), [w.mappings.Keys])
  const records = w.records
  const rows = useMemo(() => (records ?? []) as Row[], [records])
  const [mode, setMode] = useState<Mode>("exact")
  const groups = useMemo(() => (keys.length ? findGroups(rows, keys, mode) : []), [rows, keys, mode])
  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [pending, setPending] = useState<{ group: string; plan: Plan | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)
  const [tab, setTab] = useState("duplicates")
  const [report, setReport] = useState<ColumnReport[] | null>(null)

  const tableId = w.currentTableId
  const { listTables, listColumns, fetchRows } = w
  const reader = useMemo<Reader>(
    () => ({ listTables: () => listTables(), listColumns: (id) => listColumns(id), fetchRows: (id) => fetchRows(id) as Promise<Record<string, unknown>[]> }),
    [listTables, listColumns, fetchRows],
  )

  useEffect(() => {
    if (tab !== "report" || !tableId) return
    let live = true
    columnReport(reader, tableId).then(
      (r) => live && setReport(r),
      (err: unknown) => live && setError(String(err instanceof Error ? err.message : err)),
    )
    return () => {
      live = false
    }
  }, [tab, tableId, reader, records])

  // Grist sends the section only its mapped columns (the keys): the other
  // cells, which decide the row to keep, come from the table, again on each change.
  const [full, setFull] = useState<{ tableId: string; rows: ReadonlyMap<number, Row> } | null>(null)
  useEffect(() => {
    if (!tableId) return
    let live = true
    fetchRows(tableId).then(
      (all) => live && setFull({ tableId, rows: new Map(all.map((r) => [r.id, r as Row])) }),
      (err: unknown) => live && setError(String(err instanceof Error ? err.message : err)),
    )
    return () => {
      live = false
    }
  }, [fetchRows, tableId, records])
  const cells = full && full.tableId === tableId ? full.rows : null

  const idOf = (g: Row[]) => g.map((r) => r.id).join(",")
  const keepOf = (g: Row[]) => {
    const c = chosen[idOf(g)]
    return c !== undefined && g.some((r) => r.id === c) ? c : defaultKeep(g.map((r) => cells?.get(r.id) ?? r))
  }

  async function prepare(g: Row[]) {
    if (!tableId) return
    const keep = keepOf(g)
    setPending({ group: idOf(g), plan: null })
    setError(null)
    setDone(null)
    try {
      const plan = await planMerge(reader, tableId, keep, g.map((r) => r.id).filter((id) => id !== keep))
      setPending({ group: idOf(g), plan })
    } catch (err) {
      setPending(null)
      setError(t("failed", { error: err instanceof Error ? err.message : String(err) }))
    }
  }

  async function merge(plan: Plan) {
    setBusy(true)
    try {
      // One applyActions call: one action in Grist, so one undo there.
      await w.applyActions(plan.actions)
      setDone(plan.remove.length)
      setPending(null)
    } catch (err) {
      setError(t("failed", { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  if (!keys.length) return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("howTo")}</p>

  const rowName = (id: number) => t("row", { id })

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
      <TabsList>
        <TabsTrigger value="duplicates">{t("duplicates")}</TabsTrigger>
        <TabsTrigger value="report">{t("report")}</TabsTrigger>
      </TabsList>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <TabsContent value="duplicates" className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="mode" className="text-sm font-medium">
            {t("match")}
          </label>
          <div className="w-40">
            <NativeSelect id="mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <NativeSelectOption value="exact">{t("exact")}</NativeSelectOption>
              <NativeSelectOption value="close">{t("close")}</NativeSelectOption>
            </NativeSelect>
          </div>
          <p className="flex-1 text-sm text-muted-foreground">{groups.length ? t("scope", { groups: groups.length, n: rows.length }) : t("none", { n: rows.length })}</p>
        </div>

        {done !== null ? (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {t("done", { n: done })}
          </p>
        ) : null}

        <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          {groups.map((g, i) => {
            const id = idOf(g)
            const keep = keepOf(g)
            const plan = pending?.group === id ? pending.plan : undefined
            return (
              <li key={id} className="flex flex-col gap-2 rounded-lg border p-3">
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-sm font-medium">{t("group", { n: i + 1 })}</legend>
                  {g.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input type="radio" name={`keep-${id}`} checked={r.id === keep} onChange={() => setChosen((c) => ({ ...c, [id]: r.id }))} aria-label={`${t("keep")} ${rowName(r.id)}`} className="accent-primary" />
                      <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{rowName(r.id)}</span>
                      <span className="min-w-0 flex-1 truncate">{keys.map((k) => show(r[k], t("blank"))).join(" · ")}</span>
                    </label>
                  ))}
                </fieldset>
                {plan === undefined ? (
                  <Button size="sm" variant="outline" className="self-start" disabled={busy || pending !== null} onClick={() => void prepare(g)}>
                    {t("merge")}
                  </Button>
                ) : plan === null ? (
                  <p className="text-sm text-muted-foreground">{t("planning")}</p>
                ) : (
                  <div role="alertdialog" aria-labelledby={`confirm-${id}`} className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
                    <p id={`confirm-${id}`} className="font-medium">
                      {t("confirm", { keep: plan.keep, remove: plan.remove.join(", ") })}
                    </p>
                    {plan.filled ? <p>{t("filled", { n: plan.filled, keep: plan.keep })}</p> : null}
                    {plan.moved.map((m) => (
                      <p key={m.tableId}>{t("moved", { n: m.count, table: m.tableId, keep: plan.keep })}</p>
                    ))}
                    {!plan.filled && !plan.moved.length ? <p>{t("nothingElse")}</p> : null}
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => void merge(plan)}>
                        {busy ? t("merging") : t("yes")}
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setPending(null)}>
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </TabsContent>

      <TabsContent value="report" className="min-h-0 flex-1 overflow-auto">
        {report ? (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 font-medium">{t("column")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("blankCells")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("wrongType")}</th>
                <th className="py-1 pr-2 text-right font-medium">{t("errors")}</th>
                <th className="py-1 text-right font-medium">{t("broken")}</th>
              </tr>
            </thead>
            <tbody>
              {report.map((c) => (
                <tr key={c.colId} className="border-t" data-col={c.colId}>
                  <th scope="row" className="py-1 pr-2 text-left font-normal">
                    {c.label} <span className="text-xs text-muted-foreground">{c.type}</span>
                  </th>
                  <Count n={c.blank} />
                  <Count n={c.wrongType} alert />
                  <Count n={c.errors} alert />
                  {c.broken === null ? <td className="py-1 text-right">—</td> : <Count n={c.broken} alert />}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">{t("reading")}</p>
        )}
      </TabsContent>
    </Tabs>
  )
}

function Count({ n, alert }: { n: number; alert?: boolean }) {
  return <td className={`py-1 pr-2 text-right tabular-nums ${alert && n ? "font-medium text-destructive" : ""}`}>{n}</td>
}
