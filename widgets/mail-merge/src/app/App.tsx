import { useEffect, useMemo, useState } from "react"

import { checkGristCell, defineGristWidget } from "grist-widget-sdk"

import { detectLocale, useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Badge } from "@shared/ui/badge"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { NativeSelect, NativeSelectOption } from "@shared/ui/native-select"
import { Textarea } from "@shared/ui/textarea"

import { DEFAULTS, fill, link, LONG_LINK, recipients, type Client, type Row } from "./mail"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Mail merge",
  description: "A personal e-mail for each row the section shows, from a subject and a body with the row's columns in them, opened in the person's own mail app, Gmail or Outlook.",
  requiredAccess: "full",
  // Options carry their version (ADR 0017): version 1, read as before.
  optionsVersion: 1,
  columns: [
    { name: "Email", title: "Recipient's e-mail address" },
    { name: "Sent", type: "DateTime,Date,Bool", optional: true, title: "Set when the e-mail is opened (a log)" },
  ],
})

const CLIENTS: Client[] = ["mailto", "gmail", "outlook"]

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  const opts = w.widgetOptions ?? {}
  const savedSubject = typeof opts.subject === "string" ? opts.subject : DEFAULTS[locale].subject
  const savedBody = typeof opts.body === "string" ? opts.body : DEFAULTS[locale].body
  const savedClient = CLIENTS.includes(opts.client as Client) ? (opts.client as Client) : "mailto"
  const [subject, setSubject] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set())

  const s = subject ?? savedSubject
  const b = body ?? savedBody
  const c = client ?? savedClient
  const dirty = s !== savedSubject || b !== savedBody || c !== savedClient

  const emailCol = typeof w.mappings.Email === "string" ? w.mappings.Email : null
  const sentCol = typeof w.mappings.Sent === "string" ? w.mappings.Sent : null
  // The table's columns and their types: a Date cell arrives as seconds, and only its type says so.
  const [types, setTypes] = useState<ReadonlyMap<string, string | undefined> | null>(null)
  const { listColumns } = w
  const tableId = w.currentTableId
  useEffect(() => {
    if (!tableId) return
    let live = true
    listColumns(tableId).then(
      (cols) => live && setTypes(new Map(cols.map((x) => [x.colId, x.type]))),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [listColumns, tableId])
  const sentType = sentCol ? (types?.get(sentCol)?.split(":")[0] ?? null) : null

  const records = w.records
  const rows = useMemo(
    () =>
      (records ?? []).map((r) => {
        const out: Row = { id: r.id as number }
        for (const [k, v] of Object.entries(r)) {
          const check = checkGristCell(types?.get(k), v)
          out[k] = check.ok ? check.value : v
        }
        return out
      }),
    [records, types],
  )
  const columns = useMemo(() => new Set(types ? [...types.keys()] : rows.length ? Object.keys(rows[0]!).filter((k) => k !== "id") : []), [types, rows])

  const mails = useMemo(
    () =>
      rows.map((row) => {
        const to = emailCol ? recipients(row[emailCol]) : []
        const subj = fill(s, row, columns, locale)
        const text = fill(b, row, columns, locale)
        const href = link(c, to, subj.text, text.text)
        return { row, to, subject: subj.text, body: text.text, href, unknown: [...new Set([...subj.unknown, ...text.unknown])], sent: sentCol ? Boolean(row[sentCol]) : false }
      }),
    [rows, emailCol, sentCol, s, b, c, columns, locale],
  )
  const unknown = mails[0]?.unknown ?? []
  const selected = mails.find((m) => m.row.id === w.record?.id) ?? mails[0]
  const next = mails.find((m) => m.to.length && !m.sent && !opened.has(m.row.id))

  async function save() {
    setError(null)
    try {
      await w.patchWidgetOptions({ subject: s, body: b, client: c })
      setSubject(null)
      setBody(null)
      setClient(null)
    } catch (err) {
      setError(t("failed", { error: err instanceof Error ? err.message : String(err) }))
    }
  }

  function onOpen(id: number) {
    setOpened((o) => new Set(o).add(id))
    if (!sentCol) return
    const value = sentType === "Bool" ? true : sentType === "Date" ? new Date(new Date().toISOString().slice(0, 10)) : new Date()
    w.updateRecord(id, { Sent: value } as never).catch((err: unknown) => setError(t("failed", { error: err instanceof Error ? err.message : String(err) })))
  }

  if (!emailCol) return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("howTo")}</p>

  const insert = (name: string) => setBody(`${b}{{${name}}}`)
  const withAddress = mails.filter((m) => m.to.length).length

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 overflow-auto bg-background p-3 text-foreground">
      <section aria-labelledby="template" className="flex flex-col gap-2">
        <h2 id="template" className="text-sm font-medium">
          {t("template")}
        </h2>
        <label htmlFor="subject" className="text-xs text-muted-foreground">
          {t("subject")}
        </label>
        <Input id="subject" value={s} onChange={(e) => setSubject(e.target.value)} />
        <label htmlFor="body" className="text-xs text-muted-foreground">
          {t("body")}
        </label>
        <Textarea id="body" rows={6} value={b} onChange={(e) => setBody(e.target.value)} />
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("insert")}>
          <span className="text-xs text-muted-foreground">{t("insert")}</span>
          {[...columns].map((name) => (
            <Button key={name} size="xs" variant="outline" onClick={() => insert(name)}>
              {`{{${name}}}`}
            </Button>
          ))}
        </div>
        {unknown.length ? <p className="text-xs text-destructive">{t("unknown", { names: unknown.join(", ") })}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="client" className="text-xs text-muted-foreground">
            {t("openIn")}
          </label>
          <div className="w-44">
            <NativeSelect id="client" value={c} onChange={(e) => setClient(e.target.value as Client)}>
              {CLIENTS.map((x) => (
                <NativeSelectOption key={x} value={x}>
                  {t(x)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button size="sm" disabled={!dirty} onClick={() => void save()}>
            {dirty ? t("save") : t("saved")}
          </Button>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {selected ? (
        <section aria-labelledby="preview" className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
          <h2 id="preview" className="text-xs text-muted-foreground">
            {t("preview", { to: selected.to.join(", ") || t("noAddress") })}
          </h2>
          <p className="font-medium" data-testid="preview-subject">
            {selected.subject}
          </p>
          <p className="whitespace-pre-wrap" data-testid="preview-body">
            {selected.body}
          </p>
          {selected.href.length > LONG_LINK ? <p className="text-xs text-destructive">{t("long")}</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="rows" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="rows" className="flex-1 text-sm font-medium">
            {t("rows", { n: withAddress, total: mails.length })}
          </h2>
          {next ? (
            <Button size="sm" asChild>
              <a
                // eslint-disable-next-line no-restricted-syntax -- mail.ts's link(): a mailto:, Gmail or Outlook URL, its parts encoded
                href={next.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpen(next.row.id)}
              >
                {t("openNext", { to: next.to.join(", ") })}
              </a>
            </Button>
          ) : mails.length ? (
            <span role="status" className="text-xs text-muted-foreground">
              {t("allOpened")}
            </span>
          ) : null}
        </div>
        <ul className="flex flex-col divide-y rounded-lg border">
          {mails.map((m) => (
            <li key={m.row.id} className="flex items-center gap-2 px-3 py-2 text-sm" data-row={m.row.id}>
              <span className="min-w-0 flex-1 truncate">{m.to.join(", ") || <span className="text-muted-foreground">{t("noAddress")}</span>}</span>
              {m.sent ? <Badge variant="secondary">{t("sent")}</Badge> : opened.has(m.row.id) ? <Badge variant="outline">{t("opened")}</Badge> : null}
              {m.to.length ? (
                <Button size="xs" variant="outline" asChild>
                  <a
                    // eslint-disable-next-line no-restricted-syntax -- mail.ts's link(): a mailto:, Gmail or Outlook URL, its parts encoded
                    href={m.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("openFor", { to: m.to.join(", ") })}
                    onClick={() => onOpen(m.row.id)}
                  >
                    {t("open")}
                  </a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
