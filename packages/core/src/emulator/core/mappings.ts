/**
 * Resolves the `mappings` payload that `CustomSectionAPI.mappings()` returns.
 *
 * The emulator does **not** infer logical → real columns from names, as
 * real Grist doesn't: mappings come only from `state.selection.mappings`
 * (a test's `emulator.setColumnMappings(...)`). When unset, returns `null`.
 */

import type { GristWidgetColumnMap } from "../../sdk/types"
import type { EmulatorDocumentState } from "./types"

export function resolveMappings(state: EmulatorDocumentState): GristWidgetColumnMap | null {
  if (state.selection.mappings !== undefined && state.selection.mappings !== null) {
    return state.selection.mappings
  }
  return null
}
