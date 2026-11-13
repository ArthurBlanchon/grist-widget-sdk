import type { GristColumnsToMap, GristColumnToMap, GristWidgetColumnMap } from "../types"

export type ValidateColumnMappingsResult = {
  ok: boolean
  /**
   * `true` while the host has not yet reported column mappings (e.g. between
   * `grist.ready()` resolving and the first `onRecord` / `onRecords` callback,
   * or before `sectionApi.mappings()` returns). Callers should not gate UI or
   * emit mapping alerts while pending.
   */
  pending?: boolean
  /** Logical names of required columns the user has not yet mapped. */
  missing: string[]
  /** Logical names of `allowMultiple` columns mapped to an empty list. */
  emptyMultiples: string[]
}

/**
 * Merges mapping payloads from `onRecord`, `onRecords`, and `sectionApi.mappings()`.
 * Later sources win; `undefined` sources are skipped; `null` means "host reported
 * no mappings" but still counts as a known (empty) payload.
 */
export function mergeWidgetColumnMaps(
  ...sources: (GristWidgetColumnMap | null | undefined)[]
): GristWidgetColumnMap | null | undefined {
  let merged: GristWidgetColumnMap = {}
  let sawDefined = false
  for (const src of sources) {
    if (src === undefined) continue
    sawDefined = true
    if (src === null) continue
    merged = { ...merged, ...src }
  }
  if (!sawDefined) return undefined
  return merged
}

function asColumnSpec(entry: string | GristColumnToMap): GristColumnToMap {
  return typeof entry === "string" ? { name: entry } : entry
}

/**
 * Verifies that the current Grist mappings cover every required column declared
 * in `grist.ready({ columns })`.
 *
 * Use this before reading `mappedRecord` so you can render a "please configure
 * the widget" prompt instead of a confusing `null`.
 */
export function validateColumnMappings(
  spec: GristColumnsToMap | undefined | null,
  mappings: GristWidgetColumnMap | null | undefined
): ValidateColumnMappingsResult {
  const missing: string[] = []
  const emptyMultiples: string[] = []
  if (!spec) return { ok: true, pending: false, missing, emptyMultiples }

  const m = mappings ?? {}
  for (const raw of spec) {
    const col = asColumnSpec(raw)
    if (col.optional) continue
    const value = m[col.name]
    if (col.allowMultiple) {
      if (value === undefined) {
        missing.push(col.name)
      } else if (!Array.isArray(value) || value.length === 0) {
        emptyMultiples.push(col.name)
      }
    } else {
      if (value === undefined || value === null || value === "") missing.push(col.name)
    }
  }
  return {
    ok: missing.length === 0 && emptyMultiples.length === 0,
    pending: false,
    missing,
    emptyMultiples,
  }
}

/** Status while waiting for the host to report mappings (see `pending`). */
export const pendingColumnMappingStatus: ValidateColumnMappingsResult = {
  ok: true,
  pending: true,
  missing: [],
  emptyMultiples: [],
}
