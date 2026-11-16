import { useEffect, useMemo, useState, type KeyboardEvent } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { useT } from "@shared/i18n"
import { Button } from "@shared/ui/button"
import { reportUrl } from "@shared/report-url"

import { kindOf, useFiles, type Loaded } from "./files"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Attachment viewer",
  description: "The selected row's files shown large, images and PDFs in the widget; or every row's files in a gallery.",
  reportUrl: reportUrl(),
  requiredAccess: "full",
  allowSelectBy: true,
  columns: [
    { name: "Files", type: "Attachments", title: "Attachments column" },
    { name: "Caption", optional: true, title: "Caption in the gallery" },
  ],
})

/** The most files the gallery fetches: Grist has no thumbnails, so each is a full download. */
export const GALLERY_MAX = 60

type Mode = "viewer" | "gallery"
type T = ReturnType<typeof useT<keyof (typeof messages)["en"]>>

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v))

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const mode: Mode = w.widgetOptions?.mode === "gallery" ? "gallery" : "viewer"
  const [index, setIndex] = useState(0)
  const [names, setNames] = useState<ReadonlyMap<number, string>>(new Map())

  const rowFiles = useMemo(() => w.mappedRecord?.Files ?? [], [w.mappedRecord])
  const gallery = useMemo(
    () => (w.mappedRecords ?? []).flatMap((r) => (r.Files ?? []).map((id) => ({ rowId: r.id, id, caption: text(r.Caption) }))),
    [w.mappedRecords],
  )
  const shownGallery = gallery.slice(0, GALLERY_MAX)

  const { fetchRows, fetchAttachmentBlob } = w
  const files = useFiles(fetchAttachmentBlob, mode === "viewer" ? rowFiles : shownGallery.map((g) => g.id))

  // File names, from Grist's attachments table.
  const namesKey = [...rowFiles, ...shownGallery.map((g) => g.id)].join(",")
  useEffect(() => {
    if (!namesKey) return
    let live = true
    fetchRows("_grist_Attachments").then(
      (rows) => live && setNames(new Map(rows.map((r) => [r.id, typeof r.fileName === "string" ? r.fileName : `#${r.id}`]))),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [fetchRows, namesKey])
  const name = (id: number) => names.get(id) ?? `#${id}`

  // Another row: back to its first file.
  const rowId = w.record?.id
  const [shownRow, setShownRow] = useState(rowId)
  if (shownRow !== rowId) {
    setShownRow(rowId)
    setIndex(0)
  }

  const setMode = (next: Mode) => void w.patchWidgetOptions({ mode: next })

  const header = (
    <header className="flex items-center gap-2">
      <div role="group" aria-label={t("mode")} className="flex gap-1">
        {(["viewer", "gallery"] as const).map((m) => (
          <Button key={m} size="sm" variant={mode === m ? "secondary" : "ghost"} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {t(m)}
          </Button>
        ))}
      </div>
    </header>
  )

  if (mode === "gallery") {
    return (
      <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
        {header}
        <p className="text-xs text-muted-foreground">
          {gallery.length > GALLERY_MAX ? t("galleryCapped", { shown: GALLERY_MAX, n: gallery.length }) : t("galleryCount", { n: gallery.length })}
        </p>
        {gallery.length === 0 ? <p className="text-sm text-muted-foreground">{t("noFilesAtAll")}</p> : null}
        <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
          {shownGallery.map((g) => (
            <li key={`${g.rowId}:${g.id}`}>
              <button
                type="button"
                aria-label={t("open", { name: name(g.id), caption: g.caption || t("row", { id: g.rowId }) })}
                onClick={() => {
                  void w.setCursorPosition({ rowId: g.rowId })
                  setShownRow(g.rowId)
                  setIndex(Math.max(0, (w.mappedRecords?.find((r) => r.id === g.rowId)?.Files ?? []).indexOf(g.id)))
                  setMode("viewer")
                }}
                className="flex w-full flex-col gap-1 rounded-lg border p-1 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Thumb file={files.get(g.id)} name={name(g.id)} t={t} />
                <span className="truncate px-1 text-xs">{g.caption || name(g.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  if (!w.record) {
    return (
      <main className="flex h-svh flex-col gap-3 bg-background p-3 text-foreground">
        {header}
        <p className="m-auto text-sm text-muted-foreground">{t("noRow")}</p>
      </main>
    )
  }

  const current = Math.min(index, Math.max(rowFiles.length - 1, 0))
  const id = rowFiles[current]
  const step = (delta: number) => setIndex(Math.min(Math.max(current + delta, 0), rowFiles.length - 1))
  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      step(e.key === "ArrowLeft" ? -1 : 1)
    }
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
      {header}
      {id === undefined ? (
        <p className="m-auto text-sm text-muted-foreground">{t("noFiles")}</p>
      ) : (
        <>
          <section
            aria-label={t("file", { name: name(id) })}
            tabIndex={0}
            onKeyDown={onKey}
            className="flex min-h-0 flex-1 items-center justify-center rounded-lg border bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Shown file={files.get(id)} name={name(id)} t={t} />
          </section>
          <nav aria-label={t("files")} className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => step(-1)} disabled={current === 0}>
              {t("previous")}
            </Button>
            <p className="flex-1 truncate text-center text-sm" aria-live="polite">
              {t("position", { i: current + 1, n: rowFiles.length, name: name(id) })}
            </p>
            <Button size="sm" variant="outline" onClick={() => step(1)} disabled={current === rowFiles.length - 1}>
              {t("next")}
            </Button>
          </nav>
        </>
      )}
    </main>
  )
}

function Shown({ file, name, t }: { file: Loaded | undefined; name: string; t: T }) {
  if (!file || file.state === "loading") return <p className="text-sm text-muted-foreground">{t("loading")}</p>
  if (file.state === "error") return <p className="text-sm text-destructive">{t("failed", { name })}</p>
  const kind = kindOf(file.type)
  // eslint-disable-next-line no-restricted-syntax -- a blob: URL of the attachment this widget fetched
  if (kind === "image") return <img src={file.url} alt={name} className="max-h-full max-w-full object-contain" />
  // eslint-disable-next-line no-restricted-syntax -- a blob: URL of the attachment this widget fetched
  if (kind === "pdf") return <iframe src={file.url} title={name} className="size-full rounded-lg" />
  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <p className="text-sm">{t("noPreview", { name })}</p>
      <Button asChild size="sm">
        <a
          // eslint-disable-next-line no-restricted-syntax -- a blob: URL of the attachment this widget fetched
          href={file.url}
          download={name}
        >
          {t("download", { name })}
        </a>
      </Button>
    </div>
  )
}

function Thumb({ file, name, t }: { file: Loaded | undefined; name: string; t: T }) {
  const box = "flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-muted"
  if (file?.state === "ready" && kindOf(file.type) === "image") {
    return (
      <span className={box}>
        <img
          // eslint-disable-next-line no-restricted-syntax -- a blob: URL of the attachment this widget fetched
          src={file.url}
          alt=""
          className="size-full object-cover"
        />
      </span>
    )
  }
  const label = !file || file.state === "loading" ? t("loading") : file.state === "error" ? t("failedShort") : kindOf(file.type) === "pdf" ? "PDF" : t("fileShort")
  return (
    <span className={box}>
      <span className="truncate px-2 text-xs text-muted-foreground" title={name}>
        {label}
      </span>
    </span>
  )
}
