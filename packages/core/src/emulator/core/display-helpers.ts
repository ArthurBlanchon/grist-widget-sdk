import type { GristReplicaColumn } from "../../sdk/types"

/** Ref / RefList column → the gristHelper_ column holding its display values. */
export function inferDisplayHelpersByRef(
  columns: Record<string, GristReplicaColumn>
): Record<string, string> {
  const out: Record<string, string> = {}
  const helperColumns = Object.entries(columns).filter(([colId]) =>
    colId.startsWith("gristHelper_")
  )
  const usedHelpers = new Set<string>()
  const colRefToColId = new Map<number, string>()
  for (const [colId, col] of Object.entries(columns)) {
    if (typeof col?.colRef === "number" && Number.isFinite(col.colRef)) {
      colRefToColId.set(col.colRef, colId)
    }
  }
  for (const [colId, col] of Object.entries(columns)) {
    const type = col?.type
    if (typeof type !== "string" || (!type.startsWith("Ref:") && !type.startsWith("RefList:"))) {
      continue
    }
    if (typeof col.displayColRef === "number" && Number.isFinite(col.displayColRef)) {
      const helperColId = colRefToColId.get(col.displayColRef)
      if (helperColId) {
        out[colId] = helperColId
        usedHelpers.add(helperColId)
        continue
      }
    }
    const match = helperColumns.find(([, helper]) => {
      const formula = helper?.formula
      return typeof formula === "string" && (formula.includes(`$${colId}.`) || formula.includes(`$${colId}`))
    })
    if (match) {
      out[colId] = match[0]
      usedHelpers.add(match[0])
    }
  }

  // Secondary fallback for schemas where helper formulas are unavailable:
  // pair unresolved Ref/RefList columns with nearest following gristHelper_*.
  const unresolvedRefs = Object.entries(columns)
    .filter(([colId, col]) => {
      const type = col?.type
      return (
        !out[colId] &&
        typeof type === "string" &&
        (type.startsWith("Ref:") || type.startsWith("RefList:"))
      )
    })
    .sort((a, b) => (a[1]?.parentPos ?? Number.MAX_SAFE_INTEGER) - (b[1]?.parentPos ?? Number.MAX_SAFE_INTEGER))
  const helperByPos = helperColumns
    .filter(([helperId]) => !usedHelpers.has(helperId))
    .sort((a, b) => (a[1]?.parentPos ?? Number.MAX_SAFE_INTEGER) - (b[1]?.parentPos ?? Number.MAX_SAFE_INTEGER))
  for (const [refId, refCol] of unresolvedRefs) {
    const refPos = refCol?.parentPos ?? Number.MAX_SAFE_INTEGER
    const candidate = helperByPos.find(([, helperCol]) => {
      const helperPos = helperCol?.parentPos ?? Number.MAX_SAFE_INTEGER
      return helperPos > refPos
    })
    if (!candidate) continue
    out[refId] = candidate[0]
    usedHelpers.add(candidate[0])
  }
  // If multiple unresolved refs remain, greedily map by order.
  for (const [refId] of unresolvedRefs) {
    if (out[refId]) continue
    const candidate = helperByPos.find(([helperId]) => !usedHelpers.has(helperId))
    if (!candidate) continue
    out[refId] = candidate[0]
    usedHelpers.add(candidate[0])
  }
  return out
}
