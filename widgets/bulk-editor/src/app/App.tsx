import { useEffect, useMemo, useState } from "react"

import { defineGristWidget, type GristColumnInfo } from "grist-widget-sdk"
import { gristBulkUpdateRecordAction } from "grist-widget-sdk/actions"

import { fieldOf, fromForm, sameValue, toForm, type Field, type FormValue } from "@shared/grist-fields"
import { useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { NativeSelect, NativeSelectOption } from "@shared/ui/native-select"
import { Switch } from "@shared/ui/switch"
import { reportUrl } from "@shared/report-url"

import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Bulk editor",
  description: "Set one column to one value on every row the section shows, after a confirmation, in one action you can undo.",
  reportUrl: reportUrl(),
  requiredAccess: "full",
  columns: [{ name: "Target", title: "Column to set" }],
})

type Change = { id: number; fields: Record<string, unknown> }
type Done = { count: number; undo: Change[] }

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const colId = typeof w.mappings.Target === "string" ? w.mappings.Target : null

  const [column, setColumn] = useState<GristColumnInfo | null>(null)
  const { listColumns } = w
  const tableId = w.currentTableId
  useEffect(() => {
    if (!tableId || !colId) return
    let live = true
    listColumns(tableId).then(
      (cols) => live && setColumn(cols.find((c) => c.colId === colId) ?? { colId }),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [listColumns, tableId, colId])

  const field = useMemo(() => (column ? fieldOf(column) : null), [column])
  const [value, setValue] = useState<FormValue | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  const records = w.records
  const rows = useMemo(() => (records ?? []) as Record<string, unknown>[], [records])
  const current = value ?? (field ? toForm(field, null) : "")
  const parsed = field && field.kind !== "readonly" ? fromForm(field, current) : null
  /** The rows whose cell would change, with what to write and what to put back. */
  const changes = useMemo(() => {
    if (!field || !colId || !parsed?.ok) return { apply: [] as Change[], undo: [] as Change[] }
    const apply: Change[] = []
    const undo: Change[] = []
    for (const r of rows) {
      const before = toForm(field, r[colId])
      if (sameValue(before, current)) continue
      const back = fromForm(field, before)
      apply.push({ id: r.id as number, fields: { [colId]: parsed.value } })
      undo.push({ id: r.id as number, fields: { [colId]: back.ok ? back.value : r[colId] } })
    }
    return { apply, undo }
  }, [field, colId, parsed, rows, current])

  async function write(list: Change[]) {
    setBusy(true)
    setError(null)
    try {
      // One BulkUpdateRecord: one action in Grist, so one undo there too.
      if (!tableId || !colId) return false
      await w.applyActions([gristBulkUpdateRecordAction(tableId, list.map((c) => c.id), { [colId]: list.map((c) => c.fields[colId]) })])
      return true
    } catch (err) {
      setError(t("failed", { error: err instanceof Error ? err.message : String(err) }))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    const { apply, undo } = changes
    if (await write(apply)) setDone({ count: apply.length, undo })
    setConfirming(false)
  }

  async function undo() {
    if (done && (await write(done.undo))) setDone(null)
  }

  if (!field || !colId) return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("loading")}</p>

  const label = field.label
  const shown = typeof current === "string" ? current || t("blank") : Array.isArray(current) ? current.join(", ") || t("blank") : current ? t("yes") : t("no")

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
      <p className="text-sm text-muted-foreground">{t("scope", { n: rows.length })}</p>

      {field.kind === "readonly" ? (
        <p className="text-sm">{t("readOnly", { column: label })}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor="value" className="text-sm font-medium">
            {t("newValue", { column: label })}
          </label>
          <ValueInput
            field={field}
            value={current}
            invalid={parsed !== null && !parsed.ok}
            blank={t("blank")}
            onChange={(v) => {
              setValue(v)
              setConfirming(false)
              setDone(null)
            }}
          />
          {parsed && !parsed.ok ? <p className="text-xs text-destructive">{t(parsed.error)}</p> : null}
        </div>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {done ? (
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
          <span className="flex-1">{t("done", { n: done.count })}</span>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void undo()}>
            {t("undo")}
          </Button>
        </div>
      ) : confirming ? (
        <div role="alertdialog" aria-labelledby="confirm" className="flex flex-col gap-2 rounded-lg border p-3">
          <p id="confirm" className="text-sm">
            {t("confirm", { column: label, value: shown, n: changes.apply.length, total: rows.length })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void apply()}>
              {busy ? t("applying") : t("yes")}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : field.kind !== "readonly" ? (
        <Button className="self-start" disabled={!parsed?.ok || changes.apply.length === 0} onClick={() => setConfirming(true)}>
          {changes.apply.length === 0 ? t("nothing") : t("apply", { n: changes.apply.length })}
        </Button>
      ) : null}
    </main>
  )
}

function ValueInput({ field, value, invalid, blank, onChange }: { field: Field; value: FormValue; invalid: boolean; blank: string; onChange: (v: FormValue) => void }) {
  const text = typeof value === "string" ? value : ""
  const common = { id: "value", "aria-invalid": invalid || undefined }
  switch (field.kind) {
    case "bool":
      return <Switch id="value" checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
    case "number":
    case "int":
      return <Input {...common} inputMode={field.kind === "int" ? "numeric" : "decimal"} value={text} onChange={(e) => onChange(e.target.value)} />
    case "date":
      return <Input {...common} type="date" value={text} onChange={(e) => onChange(e.target.value)} />
    case "datetime":
      return <Input {...common} type="datetime-local" value={text} onChange={(e) => onChange(e.target.value)} />
    case "choice":
      return (
        <NativeSelect {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          <NativeSelectOption value="">{blank}</NativeSelectOption>
          {field.choices.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )
    case "choiceList": {
      const chosen = Array.isArray(value) ? value : []
      return (
        <div role="group" aria-labelledby="value" className="flex flex-wrap gap-1">
          {field.choices.map((c) => {
            const on = chosen.includes(c)
            return (
              <Button key={c} type="button" size="sm" variant={on ? "secondary" : "outline"} aria-pressed={on} onClick={() => onChange(on ? chosen.filter((x) => x !== c) : [...chosen, c])}>
                {c}
              </Button>
            )
          })}
        </div>
      )
    }
    default:
      return <Input {...common} value={text} onChange={(e) => onChange(e.target.value)} />
  }
}
