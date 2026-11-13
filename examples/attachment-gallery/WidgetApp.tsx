import { useEffect, useState } from "react"

import { defineGristWidget, extractGristAttachmentIdsFromCell } from "grist-widget-sdk"

import { Button } from "@/components/ui/button"

export const widget = defineGristWidget({
  title: "Attachment gallery",
  description:
    "Thumbnail grid of every attachment in the selected row. Showcases extractGristAttachmentIdsFromCell + useGrist().fetchAttachmentBlob.",
  requiredAccess: "full",
  columns: [{ name: "Attachments", type: "Attachments" }],
})

type Thumb = {
  id: string
  url: string
  contentType: string
}

export function WidgetApp() {
  const w = widget.useGrist()

  const cellValue = w.mappedRecord?.Attachments ?? null
  const ids = extractGristAttachmentIdsFromCell(cellValue)
  const idsKey = ids.join(",")

  if (w.mode === "empty") {
    return (
      <Empty
        title="No row selected"
        body="Select a row in the host Grist section to see its attachments."
      />
    )
  }

  if (ids.length === 0) {
    return (
      <Empty
        title="No attachments in this row"
        body="The mapped Attachments column is empty for the selected row."
      />
    )
  }

  const rowKey = `${String(w.record?.id ?? "")}:${idsKey}`

  return (
    <AttachmentGrid
      key={rowKey}
      ids={ids}
      recordId={w.record?.id}
      fetchAttachmentBlob={w.fetchAttachmentBlob}
    />
  )
}

function AttachmentGrid({
  ids,
  recordId,
  fetchAttachmentBlob,
}: {
  ids: string[]
  recordId: unknown
  fetchAttachmentBlob: ReturnType<typeof widget.useGrist>["fetchAttachmentBlob"]
}) {
  const [thumbs, setThumbs] = useState<Thumb[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Stable string key so the effect doesn't re-fire when the parent
  // re-renders with a structurally identical but referentially new array.
  const idsKey = ids.join(",")

  useEffect(() => {
    const currentIds = idsKey ? idsKey.split(",") : []
    let cancelled = false
    const objectUrls: string[] = []
    void (async () => {
      try {
        const next: Thumb[] = []
        for (const id of currentIds) {
          const fetched = await fetchAttachmentBlob(id)
          if (cancelled) return
          const url = URL.createObjectURL(fetched.blob)
          objectUrls.push(url)
          next.push({
            id,
            url,
            contentType: fetched.contentType,
          })
        }
        if (!cancelled) setThumbs(next)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      for (const u of objectUrls) URL.revokeObjectURL(u)
    }
  }, [idsKey, fetchAttachmentBlob])

  return (
    <div className="flex h-svh min-h-0 flex-col gap-3 p-4">
      <header>
        <h1 className="text-lg font-medium">Attachments</h1>
        <p className="text-sm text-muted-foreground">
          {ids.length} attachment{ids.length === 1 ? "" : "s"} on row{" "}
          <code className="rounded bg-muted px-1 text-xs">
            {String(recordId ?? "?")}
          </code>
        </p>
      </header>

      {error ? (
        <p className="rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading thumbnails…</p>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
        {thumbs.map((thumb) => (
          <Thumbnail key={thumb.id} thumb={thumb} />
        ))}
      </div>
    </div>
  )
}

function Thumbnail({ thumb }: { thumb: Thumb }) {
  const isImage = thumb.contentType.startsWith("image/")
  const label = `attachment-${thumb.id}`

  return (
    <figure className="group flex flex-col gap-2 rounded-lg border bg-card p-2">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded bg-muted">
        {isImage ? (
          <img
            src={thumb.url}
            alt={label}
            className="size-full object-cover"
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            {thumb.contentType || "binary"}
          </span>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="truncate text-xs">{label}</span>
        <Button asChild variant="outline" size="sm">
          <a href={thumb.url} download={label}>
            Save
          </a>
        </Button>
      </figcaption>
    </figure>
  )
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-svh items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h2 className="font-medium">{title}</h2>
        {body ? (
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        ) : null}
      </div>
    </div>
  )
}