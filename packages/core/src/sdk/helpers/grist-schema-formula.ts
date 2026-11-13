import type { GristFormulaKind, GristReplicaColumn } from "../types"

export function inferGristFormulaKind(isFormula: boolean, formulaTrimmed: string): GristFormulaKind {
  if (formulaTrimmed.length > 0) return isFormula ? "computed" : "trigger"
  return isFormula ? "empty_slot" : "none"
}

/** Use when `formulaKind` may be missing (e.g. older document builds). */
export function resolveGristFormulaKind(col: GristReplicaColumn): GristFormulaKind {
  if (col.formulaKind) return col.formulaKind
  const f = col.formula?.trim() ?? ""
  if (f.length > 0) return col.isFormula === true ? "computed" : "trigger"
  return col.isFormula === true ? "empty_slot" : "none"
}

/** Serialize cell values for JSON output. */
export function serializeJsonFriendly(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    return String(value)
  }
}
