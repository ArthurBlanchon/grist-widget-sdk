import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"

import { readLimits, refusal, type Limits } from "./limits"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "File uploader",
  description: "Drop files onto the selected row's attachments, within the types and size its owner allows.",
  requiredAccess: "full",
  columns: [{ name: "Files", type: "Attachments", title: "Attachments column" }],
})

type Named = { id: number; name: string }

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const limits = readLimits(w.widgetOptions)
  const row = w.record
  const current = w.mappedRecord?.Files ?? []
  const currentKey = current.join(",")

  const [names, setNames] = useState<ReadonlyMap<number, string>>(new Map())
  const [uploading, setUploading] = useState(0)
  const [problems, setProblems] = useState<string[]>([])
  const [over, setOver] = useState(false)
  const [settings, setSettings] = useState(false)
  const picker = useRef<HTMLInputElement>(null)

  // The files' names, from Grist's attachments table, whenever the row's files change.
  const { fetchRows } = w
  useEffect(() => {
    if (!currentKey) return
    let live = true
    fetchRows("_grist_Attachments").then(
      (rows) => live && setNames(new Map(rows.map((r) => [r.id, typeof r.fileName === "string" ? r.fileName : `#${r.id}`]))),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [fetchRows, currentKey])

  const files: Named[] = current.map((id) => ({ id, name: names.get(id) ?? `#${id}` }))
  const busy = uploading > 0

  async function add(list: FileList | File[]) {
    if (!row || busy) return
    const chosen = [...list]
    const refused = chosen.map((f) => refusal(f, limits)).filter((r) => r !== null)
    const accepted = chosen.filter((f) => refusal(f, limits) === null)
    const said = refused.map((r) => (r.reason === "size" ? t("tooBig", { name: r.name, max: limits.maxSizeMB }) : t("wrongType", { name: r.name })))
    setProblems(said)
    if (accepted.length === 0) return
    setUploading(accepted.length)
    try {
      const ids: number[] = []
      for (const file of accepted) {
        const up = await w.uploadAttachment(file, { fileName: file.name })
        ids.push(...up.ids.map(Number))
      }
      const next = [...current, ...ids.filter((id) => !current.includes(id))]
      await w.updateRecord(row.id, { Files: next })
    } catch (err) {
      setProblems([...said, t("failed", { error: err instanceof Error ? err.message : String(err) })])
    } finally {
      setUploading(0)
    }
  }

  async function remove(id: number) {
    if (!row) return
    const next = current.filter((x) => x !== id)
    try {
      await w.updateRecord(row.id, { Files: next.length ? next : null })
    } catch (err) {
      setProblems([t("failed", { error: err instanceof Error ? err.message : String(err) })])
    }
  }

  function drop(e: DragEvent) {
    e.preventDefault()
    setOver(false)
    void add(e.dataTransfer.files)
  }

  if (!row) {
    return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("noRow")}</p>
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
      <section
        aria-label={t("dropZone")}
        aria-busy={busy}
        aria-describedby="limits"
        data-over={over ? "" : undefined}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = busy ? "none" : "copy"
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center data-over:border-primary data-over:bg-accent"
      >
        <p className="text-sm">{busy ? t("uploading", { n: uploading }) : t("drop")}</p>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => picker.current?.click()}>
          {t("choose")}
        </Button>
        <input
          ref={picker}
          type="file"
          multiple
          hidden
          aria-label={t("choose")}
          accept={limits.accept || undefined}
          onChange={(e) => {
            if (e.target.files) void add(e.target.files)
            e.target.value = ""
          }}
        />
        <p id="limits" className="text-xs text-muted-foreground">
          {limits.accept ? t("limitsTypes", { types: limits.accept, max: limits.maxSizeMB }) : t("limits", { max: limits.maxSizeMB })}
        </p>
      </section>

      {problems.length ? (
        <Alert variant="destructive">
          <AlertDescription>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label={t("files")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {files.length === 0 ? <p className="text-sm text-muted-foreground">{t("none")}</p> : null}
        <ul className="flex flex-col gap-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md border px-3 py-1">
              <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
              <Button type="button" size="sm" variant="ghost" aria-label={t("remove", { name: f.name })} onClick={() => void remove(f.id)}>
                {t("removeShort")}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex flex-col gap-2 border-t pt-2">
        <Button type="button" size="sm" variant="ghost" className="self-start" aria-expanded={settings} onClick={() => setSettings((s) => !s)}>
          {t("settings")}
        </Button>
        {settings ? <Settings limits={limits} save={(next) => w.patchWidgetOptions(next)} t={t} /> : null}
      </footer>
    </main>
  )
}

function Settings({ limits, save, t }: { limits: Limits; save: (next: Limits) => Promise<unknown>; t: ReturnType<typeof useT<keyof (typeof messages)["en"]>> }) {
  const [accept, setAccept] = useState(limits.accept)
  const [max, setMax] = useState(String(limits.maxSizeMB))
  const n = Number(max.replace(",", "."))
  const valid = Number.isFinite(n) && n > 0

  function submit(e: FormEvent) {
    e.preventDefault()
    if (valid) void save({ accept: accept.trim(), maxSizeMB: n })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("acceptLabel")}</span>
        <Input value={accept} placeholder="image/*, .pdf" onChange={(e) => setAccept(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("maxLabel")}</span>
        <Input inputMode="decimal" value={max} aria-invalid={valid ? undefined : true} onChange={(e) => setMax(e.target.value)} />
      </label>
      <Button type="submit" size="sm" className="self-start" disabled={!valid}>
        {t("saveSettings")}
      </Button>
    </form>
  )
}
