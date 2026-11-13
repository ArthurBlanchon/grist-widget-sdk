/**
 * Encoding helpers for Grist cell values.
 *
 * Grist sends some types as marshalled tuples or numeric epochs. This file
 * exposes pure decode/encode functions so widget code never has to spelunk
 * Grist's wire format.
 *
 * References: Grist `grist/RowRecord` and `grist/DocActions` typings.
 */

import type { GristReplicaColumn } from "../types"

/** `["E", "ErrorClass", "message", traceback?]` — Grist error sentinel. */
export type GristEncodedError = ["E", string, string?, string?]
/** `["L", ...items]` — list (used for ChoiceList, RefList, Attachments). */
export type GristEncodedList = ["L", ...unknown[]]
/** `["D", epochSeconds, "tz/Name"]` — DateTime with timezone. */
export type GristEncodedDateTime = ["D", number, string]
/** `["d", epochSeconds]` — Date (no time). */
export type GristEncodedDate = ["d", number]
/** `["R", tableId, rowId]` — explicit reference. */
export type GristEncodedRef = ["R", string, number]
/** `["r", rowId]` — bare reference (when table is contextual). */
export type GristEncodedBareRef = ["r", number]
/** `["P", encoded]` — pending marker. */
export type GristEncodedPending = ["P"]

export type GristDecodedValue =
  | null
  | string
  | number
  | boolean
  | Date
  | GristDecodedValue[]
  | { __error: true; type: string; message?: string; traceback?: string }
  | { __ref: true; tableId?: string; rowId: number }

const MARSHALLED_TAGS = new Set(["E", "L", "D", "d", "R", "r", "P"])

function isMarshalledTuple(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    typeof value[0] === "string" &&
    value[0].length <= 2 &&
    MARSHALLED_TAGS.has(value[0])
  )
}

/**
 * Normalises a Grist `fetchTable` cell that points at a row in another table.
 * Most payloads use a bare numeric row id, but `Ref:*` values may appear as
 * `["R", tableId, rowId]` or `["r", rowId]` (same shape as {@link decodeGristValue}).
 */
export function coerceGristDocApiRefRowId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (!Array.isArray(value) || value.length < 2) return undefined
  const tag = value[0]
  if (tag === "R" && typeof value[2] === "number" && Number.isFinite(value[2])) return value[2]
  if (tag === "r" && typeof value[1] === "number" && Number.isFinite(value[1])) return value[1]
  return undefined
}

function looksLikeAttachmentColumn(column?: GristReplicaColumn): boolean {
  return column?.type === "Attachments"
}

function looksLikeChoiceListColumn(column?: GristReplicaColumn): boolean {
  return column?.type === "ChoiceList"
}

function looksLikeRefListColumn(column?: GristReplicaColumn): boolean {
  return typeof column?.type === "string" && column.type.startsWith("RefList:")
}

function looksLikeRefColumn(column?: GristReplicaColumn): boolean {
  return typeof column?.type === "string" && column.type.startsWith("Ref:")
}

function looksLikeDateColumn(column?: GristReplicaColumn): boolean {
  return column?.type === "Date"
}

function looksLikeDateTimeColumn(column?: GristReplicaColumn): boolean {
  return typeof column?.type === "string" && column.type.startsWith("DateTime")
}

/**
 * Decodes a Grist cell value into an idiomatic JS value.
 *
 * Pass the column's metadata (from `useGristSchema` or `_grist_Tables_column`)
 * for type-aware decoding (e.g. `Date` columns return `Date` even when stored as a number).
 */
export function decodeGristValue(value: unknown, column?: GristReplicaColumn): GristDecodedValue {
  if (value === null || value === undefined) return null

  if (isMarshalledTuple(value)) {
    const tag = value[0] as string
    switch (tag) {
      case "E":
        return {
          __error: true,
          type: typeof value[1] === "string" ? value[1] : "Error",
          message: typeof value[2] === "string" ? value[2] : undefined,
          traceback: typeof value[3] === "string" ? value[3] : undefined,
        }
      case "L":
        return value.slice(1).map((v) => decodeGristValue(v, undefined)) as GristDecodedValue[]
      case "D":
        if (typeof value[1] === "number") return new Date(value[1] * 1000)
        return null
      case "d":
        if (typeof value[1] === "number") return new Date(value[1] * 1000)
        return null
      case "R":
        return {
          __ref: true,
          tableId: typeof value[1] === "string" ? value[1] : undefined,
          rowId: typeof value[2] === "number" ? value[2] : 0,
        }
      case "r":
        return { __ref: true, rowId: typeof value[1] === "number" ? value[1] : 0 }
      case "P":
        return null
      default:
        return null
    }
  }

  if (looksLikeDateColumn(column) || looksLikeDateTimeColumn(column)) {
    if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000)
  }

  if (looksLikeRefColumn(column) && typeof value === "number") {
    return { __ref: true, rowId: value }
  }

  if ((looksLikeRefListColumn(column) || looksLikeChoiceListColumn(column) || looksLikeAttachmentColumn(column)) && Array.isArray(value)) {
    return value.map((v) => decodeGristValue(v, undefined)) as GristDecodedValue[]
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map((v) => decodeGristValue(v, undefined)) as GristDecodedValue[]
  return null
}

/** Convenience: true when the cell is a Grist error sentinel. */
export function isGristCellError(value: unknown): value is GristEncodedError {
  return Array.isArray(value) && value[0] === "E"
}

/**
 * Encodes a JS value into Grist's expected wire form for a given column type.
 *
 * Use before passing values to `applyUserActions` or `TableOperations.update`
 * for `Date`, `DateTime`, `Ref`, `RefList`, and `ChoiceList` columns.
 */
export function encodeGristValue(value: unknown, column?: GristReplicaColumn): unknown {
  if (value === null || value === undefined) return null

  if (looksLikeDateColumn(column) || looksLikeDateTimeColumn(column)) {
    if (value instanceof Date) return Math.floor(value.getTime() / 1000)
    if (typeof value === "string") {
      const parsed = Date.parse(value)
      if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000)
    }
    if (typeof value === "number") return Math.floor(value)
  }

  if (looksLikeRefColumn(column)) {
    if (typeof value === "number") return value
    if (value && typeof value === "object" && "rowId" in value) {
      return (value as { rowId: number }).rowId
    }
  }

  if (looksLikeRefListColumn(column) || looksLikeChoiceListColumn(column) || looksLikeAttachmentColumn(column)) {
    if (Array.isArray(value)) {
      const items = value.map((v) => {
        if (v && typeof v === "object" && "rowId" in v) return (v as { rowId: number }).rowId
        return v
      })
      return ["L", ...items]
    }
  }

  return value
}
