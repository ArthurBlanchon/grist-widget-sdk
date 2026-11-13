/**
 * What `useGrist()` shows, derived from the runtime state: status, error,
 * column-mapping status, the mapped record, and the access check. Pure
 * functions, so they are tested without React or Grist.
 */

import { validateColumnMappings, type ValidateColumnMappingsResult } from "../helpers/grist-mappings"
import type { GristColumnsToMap, GristRequiredAccess, GristWidgetColumnMap } from "../types"
import { encodeGristCell, nameOf, typeOf } from "./cells"
import type { GristRuntimeState } from "./runtime"

/** The widget's connection to Grist, as `useGrist().status` reports it. */
export type GristWidgetStatus = "booting" | "ready" | "unavailable" | "error"

export const ACCESS_RANK: Record<GristRequiredAccess, number> = { none: 0, "read table": 1, full: 2 }

export function parseAccess(raw: unknown): GristRequiredAccess | null {
  return raw === "none" || raw === "read table" || raw === "full" ? raw : null
}

export function accessLabel(level: GristRequiredAccess): string {
  return level === "full" ? "Full document access" : level === "read table" ? "Read selected table" : "No document access"
}

/** Grist granted less than the widget declared (Grist reports it with the widget options). */
export function accessDenied(state: GristRuntimeState): boolean {
  return state.grantedAccess !== null && ACCESS_RANK[state.grantedAccess] < ACCESS_RANK[state.declaredAccess]
}

export function deriveStatus(state: GristRuntimeState): GristWidgetStatus {
  switch (state.connection) {
    case "connecting":
      return "booting"
    case "not-embedded":
    case "unavailable":
      return "unavailable"
    case "error":
      return "error"
    case "ready":
      return accessDenied(state) ? "error" : "ready"
  }
}

export function deriveError(state: GristRuntimeState): string | null {
  if (state.connection === "not-embedded") return "This page is not embedded in a Grist document."
  if (state.connection === "unavailable") return "The Grist plugin API (grist-plugin-api.js) did not load."
  if (state.connection === "error") return state.connectionError
  if (state.connection === "ready" && accessDenied(state)) {
    return `Grist granted "${accessLabel(state.grantedAccess!)}"; this widget needs "${accessLabel(state.declaredAccess)}". Set the access level in the Custom widget settings.`
  }
  return null
}

const MAPPINGS_OK: ValidateColumnMappingsResult = Object.freeze({ ok: true, pending: false, missing: [], emptyMultiples: [] }) as ValidateColumnMappingsResult
const MAPPINGS_PENDING: ValidateColumnMappingsResult = Object.freeze({ ok: true, pending: true, missing: [], emptyMultiples: [] }) as ValidateColumnMappingsResult

/** Whether the declared columns are mapped: pending until Grist reports mappings. */
export function deriveColumnMappingStatus(
  columns: GristColumnsToMap | undefined,
  mappings: GristWidgetColumnMap | null
): ValidateColumnMappingsResult {
  if (!columns?.length) return MAPPINGS_OK
  if (mappings === null) return MAPPINGS_PENDING
  return validateColumnMappings(columns, mappings)
}

/**
 * A logical-name patch as real column ids, for a write, each value encoded
 * for its declared type (`encodeGristCell`: lists, dates, references), so
 * what `mappedRecord` gave can be written back as is. A column mapped to
 * several Grist columns (`allowMultiple`) can't be written back and is
 * reported in `skipped`; a name with no mapping passes through unchanged.
 */
export function mapBackPatch(
  patch: Record<string, unknown>,
  mappings: GristWidgetColumnMap,
  columns?: GristColumnsToMap
): { fields: Record<string, unknown>; skipped: string[] } {
  const fields: Record<string, unknown> = {}
  const skipped: string[] = []
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const real = mappings[name]
    if (Array.isArray(real)) {
      skipped.push(name)
      continue
    }
    const declared = columns?.find((c) => nameOf(c) === name)
    fields[typeof real === "string" && real ? real : name] = declared ? encodeGristCell(typeOf(declared), value) : value
  }
  return { fields, skipped }
}
