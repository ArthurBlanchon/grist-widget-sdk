/**
 * Resolves the `mappings` payload that `CustomSectionAPI.mappings()` returns.
 *
 * The emulator does **not** infer logical → real columns from names, as
 * real Grist doesn't: mappings come only from `state.selection.mappings`
 * (a test's `emulator.setColumnMappings(...)`). When unset, returns `null`.
 *
 * Once the widget has declared its columns (`grist.ready({ columns })`), the
 * result is Grist's (`ViewSectionRec.mappedColumns`, grist-core): one entry
 * per declared column, `null` (or `[]` for `allowMultiple`) when unmapped,
 * and a column whose base type the declaration doesn't accept is left out
 * (`ColumnToMapImpl.canByMapped`): a `Ref:People` column's base type is
 * `Ref`, so a declared `"Ref:People"` accepts it only through the SDK, which
 * declares `"Ref"`.
 */

import type { GristColumnToMap, GristWidgetColumnMap } from "../../sdk/types"
import type { EmulatorDocumentState } from "./types"

/** A column's type without its argument (`Ref:People` → `Ref`), as Grist's `extractTypeFromColType`. */
function pureType(type: string | undefined): string {
  if (!type) return "Any"
  const colon = type.indexOf(":")
  return colon === -1 ? type : type.slice(0, colon)
}

/** Grist's `ColumnToMapImpl.canByMapped`: whether a declared column accepts a column of this base type. */
export function canBeMapped(declared: string | GristColumnToMap, columnPureType: string): boolean {
  const def = typeof declared === "string" ? { type: "Any", strictType: false } : declared
  const types = (def.type ?? "Any")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  const isAny = columnPureType === "Any" || types.join(",") === "Any"
  return types.includes(columnPureType) || (isAny && !def.strictType)
}

export function resolveMappings(state: EmulatorDocumentState): GristWidgetColumnMap | null {
  const mapping = state.selection.mappings
  if (mapping === undefined || mapping === null) return null
  const request = state.configuration?.columns
  if (!request?.length) return mapping
  const columns = state.tables.get(state.selection.tableId)?.columns ?? {}
  const typeOf = (colId: string) => (colId in columns ? pureType(columns[colId].type) : null)
  // Grist sends null for an unmapped column, which GristWidgetColumnMap doesn't spell.
  const result: Record<string, string | string[] | null> = {}
  for (const declared of request) {
    const name = typeof declared === "string" ? declared : declared.name
    const multiple = typeof declared !== "string" && Boolean(declared.allowMultiple)
    result[name] = multiple ? [] : null
    const mapped = mapping[name]
    if (!mapped) continue
    if (multiple) {
      if (!Array.isArray(mapped)) continue
      result[name] = mapped.filter((id) => {
        const t = typeOf(id)
        return t !== null && canBeMapped(declared, t)
      })
    } else {
      if (Array.isArray(mapped)) continue
      const t = typeOf(mapped)
      if (t === null) continue
      result[name] = canBeMapped(declared, t) ? mapped : null
    }
  }
  return result as GristWidgetColumnMap
}
