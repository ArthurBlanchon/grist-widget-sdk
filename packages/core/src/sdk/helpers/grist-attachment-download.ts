import type { GristDocApi } from "../types"

export type GristFetchedAttachment = {
  base64: string
  contentType: string
}

export type GristFetchedAttachmentBlob = {
  blob: Blob
  contentType: string
}

function attachmentIdFromObjectRecord(record: Record<string, unknown>): string | undefined {
  for (const candidate of [record.id, record.attachmentId, record.fileId]) {
    if (candidate === undefined || candidate === null) continue
    return String(candidate)
  }
  return undefined
}

/**
 * All attachment ids found in a Grist attachment cell value (ordered, deduped).
 * Attachment columns are usually an **array** of file refs; a single id or one JSON object is also supported.
 */
export function extractGristAttachmentIdsFromCell(value: unknown): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push(id)
  }

  const walk = (v: unknown): void => {
    if (v === undefined || v === null) return
    if (typeof v === "number") {
      push(String(v))
      return
    }
    if (typeof v === "string") {
      const trimmed = v.trim()
      if (!trimmed) return
      if (/^\d+$/.test(trimmed)) {
        push(trimmed)
        return
      }
      try {
        walk(JSON.parse(trimmed) as unknown)
      } catch {
        /* ignore */
      }
      return
    }
    if (Array.isArray(v)) {
      for (const item of v) walk(item)
      return
    }
    if (typeof v === "object") {
      const record = v as Record<string, unknown>
      const direct = attachmentIdFromObjectRecord(record)
      if (direct !== undefined) {
        push(direct)
        return
      }
      for (const nested of Object.values(record)) walk(nested)
    }
  }

  walk(value)
  return out
}

/** First attachment id in the cell, if any (see {@link extractGristAttachmentIdsFromCell}). */
export function extractGristAttachmentId(value: unknown): string | undefined {
  return extractGristAttachmentIdsFromCell(value)[0]
}

/**
 * Signed Grist download URL for a single attachment id (`getAccessToken` + query auth).
 */
export async function getAttachmentDownloadUrl(
  docApi: GristDocApi,
  attachmentId: string,
  options?: { readOnly?: boolean }
): Promise<string> {
  const getAccessToken = docApi.getAccessToken
  if (!getAccessToken) {
    throw new Error("getAccessToken is not available on docApi")
  }
  const { token, baseUrl } = await getAccessToken({ readOnly: options?.readOnly ?? false })
  return `${baseUrl}/attachments/${attachmentId}/download?auth=${token}`
}

/** URL for the `index`’th attachment in a cell value (0-based). */
export async function getAttachmentDownloadUrlForCell(
  docApi: GristDocApi,
  cellValue: unknown,
  index: number,
  options?: { readOnly?: boolean }
): Promise<string | null> {
  const ids = extractGristAttachmentIdsFromCell(cellValue)
  const id = ids[index]
  if (!id) return null
  return getAttachmentDownloadUrl(docApi, id, options)
}

async function fetchBytesFromSignedAttachmentUrl(url: string): Promise<{
  buffer: ArrayBuffer
  contentType: string
}> {
  const response = await fetch(url)
  const contentType = response.headers.get("content-type")?.trim() || "application/octet-stream"
  if (!response.ok) {
    throw new Error(`Attachment download failed (${response.status})`)
  }
  const buffer = await response.arrayBuffer()
  return { buffer, contentType }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Token + URL + fetch for one attachment id. */
export async function fetchAttachmentBase64(
  docApi: GristDocApi,
  attachmentId: string,
  options?: { readOnly?: boolean }
): Promise<GristFetchedAttachment> {
  const url = await getAttachmentDownloadUrl(docApi, attachmentId, options)
  const { buffer, contentType } = await fetchBytesFromSignedAttachmentUrl(url)
  return { base64: bufferToBase64(buffer), contentType }
}

/** Download attachment bytes as a `Blob` (preferred for large files). */
export async function fetchAttachmentBlob(
  docApi: GristDocApi,
  attachmentId: string,
  options?: { readOnly?: boolean }
): Promise<GristFetchedAttachmentBlob> {
  const url = await getAttachmentDownloadUrl(docApi, attachmentId, options)
  const { buffer, contentType } = await fetchBytesFromSignedAttachmentUrl(url)
  return { blob: new Blob([buffer], { type: contentType }), contentType }
}

/** Download the `index`’th attachment in a cell (0-based). */
export async function fetchAttachmentBase64ForCell(
  docApi: GristDocApi,
  cellValue: unknown,
  index: number,
  options?: { readOnly?: boolean }
): Promise<GristFetchedAttachment | null> {
  const url = await getAttachmentDownloadUrlForCell(docApi, cellValue, index, options)
  if (!url) return null
  const { buffer, contentType } = await fetchBytesFromSignedAttachmentUrl(url)
  return { base64: bufferToBase64(buffer), contentType }
}
