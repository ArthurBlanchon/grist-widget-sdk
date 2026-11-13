export type GristColumnLike = {
  formula?: string
}

export type GristNoiseColumnsOptions = {
  excludeId?: boolean
  excludeGristHelpers?: boolean
  excludeLoggingColumns?: boolean
  /**
   * When `true`, treat Grist's `manualSort` column as noise (omit from filtered replicas).
   * Default `false` — `manualSort` is kept unless you opt in.
   */
  excludeManualSort?: boolean
}

const NOISE_COLUMN_FORMULAS = new Set(["now()"])

function normalizeFormulaForComparison(formula: string): string {
  return formula.trim().toLowerCase().replace(/\s+/g, "")
}

/**
 * Grist-centric "technical column" detection used by document hooks and widgets.
 *
 * - `id` (when {@link GristNoiseColumnsOptions.excludeId} is true — default)
 * - `manualSort` (only when {@link GristNoiseColumnsOptions.excludeManualSort} is true)
 * - `gristHelper_*` (when `excludeGristHelpers` is true — default)
 * - trigger/logging formulas (`NOW()`, `user.*`) (when `excludeLoggingColumns` is true — default)
 */
export function isGristNoiseColumn(
  colId: string,
  col?: GristColumnLike,
  options?: GristNoiseColumnsOptions
): boolean {
  const excludeId = options?.excludeId ?? true
  const excludeGristHelpers = options?.excludeGristHelpers ?? true
  const excludeLoggingColumns = options?.excludeLoggingColumns ?? true
  const excludeManualSort = options?.excludeManualSort ?? false

  if (excludeId && colId === "id") return true
  if (excludeManualSort && colId === "manualSort") return true
  if (excludeGristHelpers && colId.startsWith("gristHelper_")) return true

  if (excludeLoggingColumns) {
    const formula = typeof col?.formula === "string" ? normalizeFormulaForComparison(col.formula) : ""
    if (formula && NOISE_COLUMN_FORMULAS.has(formula)) return true
    if (formula.startsWith("user.")) return true
  }

  return false
}
