import { useEffect, useState } from "react"

import { parseDeployPath } from "./deploy-path"

/** One entry of the `versions.json` a widget's deploy pipeline maintains. */
export type ReleasedVersion = {
  version: string
  publishedAt: string
}

export type UseReleasedVersionsResult = {
  /** Newest first, as the deploy writes them; `null` until loaded. */
  versions: ReleasedVersion[] | null
  /** `true` when `versions.json` couldn't be fetched or read. */
  error: boolean
}

/**
 * The widget's released versions, read from the `versions.json` next to its
 * channels (see {@link parseDeployPath}). For a page shown outside Grist,
 * such as a release page linking to each version.
 */
export function useReleasedVersions(
  pathname: string = typeof window === "undefined" ? "/" : window.location.pathname
): UseReleasedVersionsResult {
  const url = `${parseDeployPath(pathname).basePath}versions.json`
  const [result, setResult] = useState<UseReleasedVersionsResult>({ versions: null, error: false })

  useEffect(() => {
    let cancelled = false
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: unknown) => {
        if (cancelled) return
        if (!Array.isArray(data)) throw new Error("versions.json is not an array")
        setResult({ versions: data as ReleasedVersion[], error: false })
      })
      .catch(() => {
        if (!cancelled) setResult({ versions: null, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return result
}
