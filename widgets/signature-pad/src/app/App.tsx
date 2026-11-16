import { useEffect, useRef, useState, type PointerEvent } from "react"

import { defineGristWidget } from "grist-widget-sdk"

import { detectLocale, useT } from "@shared/i18n"
import { Alert, AlertDescription } from "@shared/ui/alert"
import { Button } from "@shared/ui/button"
import { Input } from "@shared/ui/input"
import { reportUrl } from "@shared/report-url"

import { drawStrokes, signatureImage, type Stroke } from "./ink"
import { messages } from "./messages"

export const widget = defineGristWidget({
  title: "Signature pad",
  description: "Have the selected row signed on a tablet, a phone or with a mouse; the signature is saved as an image with the signer's name and the time.",
  reportUrl: reportUrl(),
  requiredAccess: "full",
  columns: [
    { name: "Signature", type: "Attachments", title: "Signature (an attachments column)" },
    { name: "SignedBy", type: "Text", optional: true, title: "Signed by" },
    { name: "SignedAt", type: "DateTime,Date", optional: true, title: "Signed at" },
  ],
})

export default function App() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  const row = w.record
  const signed = (w.mappedRecord?.Signature ?? []).at(-1)
  const [again, setAgain] = useState<number | null>(null)

  if (!row) return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("noRow")}</p>

  const signedAt = w.mappedRecord?.SignedAt
  if (signed !== undefined && again !== row.id) {
    return (
      <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
        <Signed id={signed} fetchBlob={w.fetchAttachmentBlob} label={t("signature")} />
        <p className="text-sm">
          {w.mappedRecord?.SignedBy ? t("signedBy", { name: w.mappedRecord.SignedBy }) : t("signed")}
          {signedAt instanceof Date ? ` · ${signedAt.toLocaleString(locale)}` : ""}
        </p>
        <Button variant="outline" className="self-start" onClick={() => setAgain(row.id)}>
          {t("again")}
        </Button>
      </main>
    )
  }

  return <Pad key={row.id} onSaved={() => setAgain(null)} />
}

function Pad({ onSaved }: { onSaved: () => void }) {
  const w = widget.useGrist()
  const t = useT(messages)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState("")
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drawing = useRef(false)
  const hasSignature = typing ? typed.trim() !== "" : strokes.length > 0

  // Redraw on every change, in the theme's text colour (the saved image is always dark on white).
  useEffect(() => {
    const c = canvas.current
    const ctx = c?.getContext("2d")
    if (!c || !ctx) return
    const { width, height } = c.getBoundingClientRect()
    c.width = Math.max(1, Math.round(width))
    c.height = Math.max(1, Math.round(height))
    ctx.clearRect(0, 0, c.width, c.height)
    drawStrokes(ctx, strokes, c.width, c.height, getComputedStyle(c).color)
  }, [strokes])

  function at(e: PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: r.width ? (e.clientX - r.left) / r.width : 0, y: r.height ? (e.clientY - r.top) / r.height : 0 }
  }

  async function save() {
    const row = w.record
    if (!row || !hasSignature) return
    setSaving(true)
    setError(null)
    try {
      const image = await signatureImage(typing ? { typed: typed.trim() } : { strokes })
      const up = await w.uploadAttachment(image, { fileName: `signature-${row.id}.png` })
      const patch: Parameters<typeof w.updateRecord>[1] = { Signature: up.ids.map(Number) }
      if (w.mappings.SignedBy) patch.SignedBy = name.trim() || (typing ? typed.trim() : null)
      if (w.mappings.SignedAt) patch.SignedAt = new Date()
      await w.updateRecord(row.id, patch)
      onSaved()
    } catch (err) {
      setError(t("failed", { error: err instanceof Error ? err.message : String(err) }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex h-svh min-h-0 flex-col gap-3 bg-background p-3 text-foreground">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t("name")}</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>

      {typing ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("typeLabel")}</span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="font-serif text-2xl italic" />
        </label>
      ) : (
        <canvas
          ref={canvas}
          role="img"
          aria-label={strokes.length ? t("padDrawn") : t("pad")}
          className="min-h-32 w-full flex-1 touch-none rounded-lg border bg-background text-foreground"
          onPointerDown={(e) => {
            drawing.current = true
            e.currentTarget.setPointerCapture?.(e.pointerId)
            // Read the point now: React clears the event's currentTarget once the handler returns.
            const p = at(e)
            setStrokes((s) => [...s, [p]])
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const p = at(e)
            setStrokes((s) => [...s.slice(0, -1), [...(s.at(-1) ?? []), p]])
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <footer className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setTyping((v) => !v)}>
          {typing ? t("drawInstead") : t("typeInstead")}
        </Button>
        <Button variant="outline" className="ml-auto" disabled={!hasSignature || saving} onClick={() => (typing ? setTyped("") : setStrokes([]))}>
          {t("clear")}
        </Button>
        <Button disabled={!hasSignature || saving} onClick={() => void save()}>
          {saving ? t("saving") : t("save")}
        </Button>
      </footer>
    </main>
  )
}

function Signed({ id, fetchBlob, label }: { id: number; fetchBlob: (id: string) => Promise<{ blob: Blob }>; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let made: string | null = null
    fetchBlob(String(id)).then(
      ({ blob }) => {
        if (!live) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      },
      () => undefined,
    )
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [fetchBlob, id])
  return (
    <div className="flex min-h-32 flex-1 items-center justify-center rounded-lg border bg-muted/40">
      {url ? (
        <img
          // eslint-disable-next-line no-restricted-syntax -- a blob: URL of the signature this widget fetched
          src={url}
          alt={label}
          className="max-h-full max-w-full object-contain"
        />
      ) : null}
    </div>
  )
}
