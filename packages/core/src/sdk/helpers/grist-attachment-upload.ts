import type { GristDocApi } from "../types"
import { extractGristAttachmentIdsFromCell } from "./grist-attachment-download"
import { fetchWithGristAuth } from "./grist-fetch-with-auth"
import { encodeGristValue } from "./grist-value-codec"

const ATTACHMENTS_COLUMN = { type: "Attachments" as const }

export type GristEncodedAttachmentList = ["L", ...(number | string)[]]

export type GristAttachmentUploadResult = {
  /** All attachment ids returned by `POST /attachments`. */
  ids: string[]
  /** First id in `ids` (convenience for single-file uploads). */
  firstId: string
}

/**
 * Parse the body of `POST /attachments` (widget or REST).
 * Grist returns a JSON array of attachment ids, e.g. `[42]` or `[101, 102]`.
 */
export function parseGristAttachmentUploadResponseIds(
  raw: string,
  options?: { strict?: boolean }
): string[] {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error("Attachment upload returned an empty response.")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch {
    if (options?.strict) {
      throw new Error("Attachment upload returned non-JSON response.")
    }
    parsed = trimmed
  }

  return extractAttachmentIdsFromUploadPayload(parsed, options)
}

/**
 * First attachment id from an upload response (see {@link parseGristAttachmentUploadResponseIds}).
 */
export function parseGristAttachmentUploadResponse(
  raw: string,
  options?: { strict?: boolean }
): string {
  const ids = parseGristAttachmentUploadResponseIds(raw, options)
  return ids[0]!
}

export function extractAttachmentIdsFromUploadPayload(
  parsed: unknown,
  options?: { strict?: boolean }
): string[] {
  if (options?.strict) {
    return extractAttachmentIdsFromUploadPayloadStrict(parsed)
  }

  const first = extractFirstAttachmentIdFromUploadPayload(parsed)
  if (first !== undefined) {
    if (Array.isArray(parsed)) {
      const ids: string[] = []
      const seen = new Set<string>()
      for (const item of parsed) {
        const id = coerceAttachmentId(item)
        if (id && !seen.has(id)) {
          seen.add(id)
          ids.push(id)
        }
      }
      return ids.length > 0 ? ids : [first]
    }
    return [first]
  }

  throw new Error("Attachment upload returned an unexpected response shape.")
}

function extractAttachmentIdsFromUploadPayloadStrict(parsed: unknown): string[] {
  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    return [String(parsed)]
  }

  if (Array.isArray(parsed)) {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      if (typeof item !== "number" || !Number.isFinite(item)) {
        throw new Error("Attachment upload returned an unexpected response shape.")
      }
      const id = String(item)
      if (!seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
    if (ids.length === 0) {
      throw new Error("Attachment upload returned an empty id list.")
    }
    return ids
  }

  throw new Error("Attachment upload returned an unexpected response shape.")
}

/** @deprecated Prefer {@link extractAttachmentIdsFromUploadPayload}. */
export function extractFirstAttachmentIdFromUploadPayload(parsed: unknown): string | undefined {
  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    return String(parsed)
  }

  if (typeof parsed === "string" && parsed.trim()) {
    return parsed.trim()
  }

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const id = coerceAttachmentId(item)
      if (id) return id
    }
    return undefined
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>
    for (const key of ["id", "attachmentId", "fileId"]) {
      const id = coerceAttachmentId(record[key])
      if (id) return id
    }
  }

  return undefined
}

function coerceAttachmentId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  return undefined
}

function normalizeAttachmentIdForWire(id: string | number): number | string {
  const numeric = typeof id === "number" ? id : Number(id)
  if (Number.isFinite(numeric) && String(numeric) === String(id).trim()) {
    return numeric
  }
  return typeof id === "number" ? String(id) : id.trim()
}

/** Wire value for an Attachments cell (Grist list encoding). */
export function gristAttachmentCellValues(
  attachmentIds: (string | number)[]
): GristEncodedAttachmentList {
  const items = attachmentIds.map(normalizeAttachmentIdForWire)
  const encoded = encodeGristValue(items, ATTACHMENTS_COLUMN)
  if (!Array.isArray(encoded) || encoded[0] !== "L") {
    return ["L", ...items]
  }
  return encoded as GristEncodedAttachmentList
}

/** Wire value for a single-file Attachments cell. */
export function gristAttachmentCellValue(attachmentId: string | number): GristEncodedAttachmentList {
  return gristAttachmentCellValues([attachmentId])
}

/**
 * Merge new attachment ids into an existing Attachments cell value (deduped, order preserved).
 */
export function mergeGristAttachmentCellValue(
  existingCell: unknown,
  newIds: (string | number)[]
): GristEncodedAttachmentList {
  const existing = extractGristAttachmentIdsFromCell(existingCell)
  const merged: string[] = []
  const seen = new Set<string>()
  const push = (raw: string | number) => {
    const id = String(raw).trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    merged.push(id)
  }
  for (const id of existing) push(id)
  for (const id of newIds) push(id)
  return gristAttachmentCellValues(merged)
}

const UPLOAD_HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json",
} as const

/**
 * Upload a file to the current document via `POST /attachments`.
 *
 * Uses `getAccessToken({ readOnly: false })` and `?auth=` (see Grist widget docs).
 * Requires document **full** access in the widget.
 */
export async function uploadGristAttachment(
  docApi: GristDocApi,
  file: Blob | File,
  options?: { fileName?: string }
): Promise<GristAttachmentUploadResult> {
  const form = new FormData()
  const fileName =
    options?.fileName ?? (file instanceof File && file.name ? file.name : "upload")
  form.append("upload", file, fileName)

  let response: Response
  try {
    response = await fetchWithGristAuth(docApi, "/attachments", {
      method: "POST",
      body: form,
      readOnly: false,
      headers: UPLOAD_HEADERS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/failed to fetch/i.test(msg)) {
      const widgetOrigin =
        typeof globalThis.location !== "undefined"
          ? globalThis.location.origin
          : "this widget origin"
      throw new Error(
        `Attachment upload was blocked by the Grist host (CORS). The browser could not POST from ${widgetOrigin} to the document API. If upload worked from a dev URL (e.g. ngrok) but fails after deploy, add the new widget URL to your Grist server CORS allowlist (see grist-core#2040).`,
        { cause: err }
      )
    }
    throw err
  }

  const raw = await response.text()
  if (!response.ok) {
    throw new Error(
      raw.trim()
        ? `Attachment upload failed (${response.status}): ${raw.slice(0, 200)}`
        : `Attachment upload failed (${response.status})`
    )
  }

  const ids = parseGristAttachmentUploadResponseIds(raw)
  return { ids, firstId: ids[0]! }
}
