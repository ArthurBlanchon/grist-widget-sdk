import { useEffect, useRef, useState } from "react"

/** A file as the widget shows it: its object URL and type once fetched, or why not. */
export type Loaded = { state: "loading" } | { state: "ready"; url: string; type: string } | { state: "error" }

export type Kind = "image" | "pdf" | "other"

export function kindOf(type: string): Kind {
  if (type.startsWith("image/")) return "image"
  if (type === "application/pdf") return "pdf"
  return "other"
}

type Fetch = (id: string) => Promise<{ blob: Blob; contentType: string }>

/**
 * The files `ids` name, fetched once each and kept as object URLs for the
 * widget's life; they are revoked when it unmounts.
 */
export function useFiles(fetchBlob: Fetch, ids: readonly number[]): ReadonlyMap<number, Loaded> {
  const [files, setFiles] = useState<ReadonlyMap<number, Loaded>>(new Map())
  const started = useRef(new Set<number>())
  const urls = useRef<string[]>([])
  const key = ids.join(",")

  useEffect(() => {
    for (const id of key ? key.split(",").map(Number) : []) {
      if (started.current.has(id)) continue
      started.current.add(id)
      setFiles((m) => new Map(m).set(id, { state: "loading" }))
      fetchBlob(String(id)).then(
        ({ blob, contentType }) => {
          const url = URL.createObjectURL(blob)
          urls.current.push(url)
          setFiles((m) => new Map(m).set(id, { state: "ready", url, type: contentType }))
        },
        () => setFiles((m) => new Map(m).set(id, { state: "error" })),
      )
    }
  }, [fetchBlob, key])

  useEffect(() => {
    const made = urls.current
    return () => made.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  return files
}
