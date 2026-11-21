import { useEffect, useMemo, useState, type FormEvent } from "react"

import { defineGristWidget, type GristColumnInfo } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Badge } from "@shared/ui/badge"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { NativeSelect, NativeSelectOption } from "@shared/ui/native-select"
import { Switch } from "@shared/ui/switch"
import { Textarea } from "@shared/ui/textarea"

import { display, fieldOf, fromForm, sameValue, toForm, type Field, type FormValue } from "@shared/grist-fields"
import { reportUrl } from "@shared/report-url"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Record editor",
  description: "Edit the selected row in a form, each field typed by its column, with Save and Cancel; or add a row.",
  reportUrl: reportUrl(),
  requiredAccess: "full",
  // It shows the row selected in another section: unlinked, it would show one row for good.
  requiredLinking: "target",
  columns: [{ name: "Fields", allowMultiple: true, title: "Fields of the form" }],
})

type Option = { id: number; label: string }
type Drafts = Record<string, Record<string, FormValue>>

const NEW = "new"

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const tableId = w.currentTableId
  // Stable methods (the SDK keeps them across renders), so the effects below run only when their inputs change.
  const { listColumns, fetchRows } = w
  const mapped = w.mappings.Fields
  const fieldIds = useMemo(() => (Array.isArray(mapped) ? mapped : mapped ? [mapped] : []), [mapped])

  const [columns, setColumns] = useState<Map<string, GristColumnInfo> | null>(null)
  const [options, setOptions] = useState<Record<string, Option[]>>({})
  const [drafts, setDrafts] = useState<Drafts>({})
  // New was pressed while this row (or none) was selected; selecting another row leaves the new row's form.
  const [newFrom, setNewFrom] = useState<number | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  // The table's columns: types, labels, choices, referenced tables.
  useEffect(() => {
    if (!tableId) return
    let live = true
    listColumns(tableId).then(
      (cols) => live && setColumns(new Map(cols.map((c) => [c.colId, c]))),
      (err: unknown) => live && setError(String(err instanceof Error ? err.message : err)),
    )
    return () => {
      live = false
    }
  }, [listColumns, tableId])

  const fields = useMemo<Field[]>(
    () => (columns ? fieldIds.map((id) => fieldOf(columns.get(id) ?? { colId: id })) : []),
    [columns, fieldIds],
  )

  // The rows each Ref field can point to, labelled by the column the reference shows.
  const refKey = fields
    .filter((f) => f.kind === "ref")
    .map((f) => `${f.refTable}:${f.visibleCol ?? ""}`)
    .join("|")
  useEffect(() => {
    let live = true
    for (const f of fields) {
      if (f.kind !== "ref" || !f.refTable) continue
      const key = `${f.refTable}:${f.visibleCol ?? ""}`
      const visible = f.visibleCol
      fetchRows(f.refTable).then(
        (rows) =>
          live &&
          setOptions((o) => ({
            ...o,
            [key]: rows.map((r) => ({ id: r.id, label: (visible ? display(r[visible]) : "") || `#${r.id}` })),
          })),
        () => undefined,
      )
    }
    return () => {
      live = false
    }
    // refKey stands for the Ref fields' targets: refetch only when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRows, refKey])

  const record = w.record
  // Grist sends a reference as the text its column shows, not the row id:
  // the ids come from the table itself, read once and again when its rows
  // change (not on each move of the cursor).
  const hasRef = fields.some((f) => f.kind === "ref")
  const records = w.records
  const [refIds, setRefIds] = useState<{ tableId: string; rows: ReadonlyMap<number, Record<string, unknown>> } | null>(null)
  useEffect(() => {
    if (!tableId || !hasRef) return
    let live = true
    fetchRows(tableId).then(
      (rows) => live && setRefIds({ tableId, rows: new Map(rows.map((r) => [r.id, r])) }),
      (err: unknown) => live && setError(t("readFailed", { error: err instanceof Error ? err.message : String(err) })),
    )
    return () => {
      live = false
    }
    // t is stable for a locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRows, tableId, hasRef, records])
  const adding = newFrom !== undefined && newFrom === (record?.id ?? null)
  const setAdding = (on: boolean) => setNewFrom(on ? (record?.id ?? null) : undefined)

  const key = adding ? NEW : record ? String(record.id) : null
  const original = useMemo<Record<string, FormValue>>(() => {
    const out: Record<string, FormValue> = {}
    const ids = refIds && refIds.tableId === tableId && record ? (refIds.rows.get(record.id as number) ?? null) : null
    for (const f of fields) {
      const cell = (record as Record<string, unknown> | null)?.[f.colId]
      out[f.colId] = toForm(f, adding ? null : f.kind === "ref" ? (ids ? ids[f.colId] : null) : cell)
    }
    return out
  }, [fields, record, adding, refIds, tableId])
  const draft = key ? (drafts[key] ?? {}) : {}
  const value = (f: Field) => (f.colId in draft ? draft[f.colId]! : original[f.colId]!)

  const parsed = fields.map((f) => ({ f, p: f.kind === "readonly" ? null : fromForm(f, value(f)) }))
  const changed = parsed.filter(({ f, p }) => p && (adding ? f.colId in draft : !sameValue(value(f), original[f.colId]!)))
  const invalid = parsed.some(({ p }) => p && !p.ok)
  const dirty = changed.length > 0

  function edit(colId: string, next: FormValue) {
    if (!key) return
    setSavedKey(null)
    setDrafts((d) => ({ ...d, [key]: { ...d[key], [colId]: next } }))
  }

  function discard() {
    if (!key) return
    setError(null)
    setDrafts((d) => {
      const rest = { ...d }
      delete rest[key]
      return rest
    })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!key || invalid || !dirty) return
    const cells: Record<string, unknown> = {}
    for (const { f, p } of changed) if (p?.ok) cells[f.colId] = p.value
    setSaving(true)
    setError(null)
    try {
      if (adding) {
        const created = await w.table.create({ fields: cells })
        const id = Array.isArray(created) ? created[0]?.id : created.id
        discard()
        setAdding(false)
        if (id) await w.setCursorPosition({ rowId: id })
      } else {
        await w.table.update({ id: record!.id, fields: cells })
        // The saved references, until the table is read again.
        setRefIds((r) => {
          if (!r) return r
          const rows = new Map(r.rows)
          rows.set(record!.id as number, { ...rows.get(record!.id as number), ...cells })
          return { ...r, rows }
        })
        discard()
        setSavedKey(key)
      }
    } catch (err) {
      setError(t("saveFailed", { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setSaving(false)
    }
  }

  function startNew() {
    setError(null)
    setAdding(true)
  }

  if (!key) {
    return (
      <main className="flex h-svh flex-col items-center justify-center gap-3 bg-background p-6 text-center text-foreground">
        <p className="max-w-sm text-sm text-muted-foreground">{t("noRow")}</p>
        <Button onClick={startNew}>{t("new")}</Button>
      </main>
    )
  }

  return (
    <form onSubmit={save} className="flex h-svh min-h-0 flex-col bg-background text-foreground" aria-busy={saving}>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <h1 className="flex-1 truncate text-base font-medium">{adding ? t("newTitle") : t("title", { id: record!.id })}</h1>
        {dirty ? <Badge variant="secondary">{t("unsaved")}</Badge> : savedKey === key ? <Badge variant="outline">{t("saved")}</Badge> : null}
        <Button type="button" size="sm" variant="ghost" onClick={startNew} disabled={adding}>
          {t("new")}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {columns === null ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}
        {parsed.map(({ f, p }) => (
          <FieldRow
            key={f.colId}
            field={f}
            value={value(f)}
            options={f.refTable ? options[`${f.refTable}:${f.visibleCol ?? ""}`] : undefined}
            error={p && !p.ok ? t(p.error) : null}
            onChange={(v) => edit(f.colId, v)}
            t={t}
          />
        ))}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button type="button" variant="outline" onClick={adding ? () => (discard(), setAdding(false)) : discard} disabled={saving || (!dirty && !adding)}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={saving || invalid || !dirty}>
          {saving ? t("saving") : t("save")}
        </Button>
      </footer>
    </form>
  )
}

type T = ReturnType<typeof useT<keyof (typeof messages)["en"]>>

function FieldRow({
  field: f,
  value,
  options,
  error,
  onChange,
  t,
}: {
  field: Field
  value: FormValue
  options: Option[] | undefined
  error: string | null
  onChange: (v: FormValue) => void
  t: T
}) {
  const id = `field-${f.colId}`
  const errorId = `${id}-error`
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? errorId : undefined }
  const text = typeof value === "string" ? value : ""

  let control
  switch (f.kind) {
    case "bool":
      control = <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
      break
    case "longText":
      control = <Textarea {...common} value={text} onChange={(e) => onChange(e.target.value)} />
      break
    case "number":
    case "int":
      control = <Input {...common} inputMode={f.kind === "int" ? "numeric" : "decimal"} value={text} onChange={(e) => onChange(e.target.value)} />
      break
    case "date":
      control = <Input {...common} type="date" value={text} onChange={(e) => onChange(e.target.value)} />
      break
    case "datetime":
      control = <Input {...common} type="datetime-local" value={text} onChange={(e) => onChange(e.target.value)} />
      break
    case "choice": {
      const choices = text && !f.choices.includes(text) ? [...f.choices, text] : f.choices
      control = (
        <NativeSelect {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          <NativeSelectOption value="">{t("none")}</NativeSelectOption>
          {choices.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {c}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )
      break
    }
    case "choiceList": {
      const chosen = Array.isArray(value) ? value : []
      const choices = [...f.choices, ...chosen.filter((c) => !f.choices.includes(c))]
      control = (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1">
          {choices.map((c) => {
            const on = chosen.includes(c)
            return (
              <Button
                key={c}
                type="button"
                size="sm"
                variant={on ? "secondary" : "outline"}
                aria-pressed={on}
                onClick={() => onChange(on ? chosen.filter((x) => x !== c) : [...chosen, c])}
              >
                {c}
              </Button>
            )
          })}
        </div>
      )
      break
    }
    case "ref": {
      const list = options ?? (text ? [{ id: Number(text), label: `#${text}` }] : [])
      control = (
        <NativeSelect {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          <NativeSelectOption value="">{t("none")}</NativeSelectOption>
          {list.map((o) => (
            <NativeSelectOption key={o.id} value={String(o.id)}>
              {o.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )
      break
    }
    case "readonly":
      control = <Input id={id} readOnly value={text} title={t("readOnly")} className="bg-muted" />
      break
    default:
      control = <Input {...common} value={text} onChange={(e) => onChange(e.target.value)} />
  }

  return (
    <div className="flex flex-col gap-1">
      {f.kind === "choiceList" ? (
        <span id={`${id}-label`} className="text-sm font-medium">
          {f.label}
        </span>
      ) : (
        <label htmlFor={id} className="text-sm font-medium">
          {f.label}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
