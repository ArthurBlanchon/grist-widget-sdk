/** The chart's data: rows grouped by their label, each series totalled. */

export type Aggregate = "sum" | "average" | "count"
export const AGGREGATES: readonly Aggregate[] = ["sum", "average", "count"]

export type ChartKind = "bar" | "stacked" | "line" | "area" | "combined" | "pie" | "radar"
export const KINDS: readonly ChartKind[] = ["bar", "stacked", "line", "area", "combined", "pie", "radar"]

/** One point of the chart: a label, and a number per series key (`s0`, `s1`…). */
export type Datum = { label: string } & Record<string, number | string>

const keyOf = (v: unknown) => {
  if (v === null || v === undefined || v === "") return ""
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (Array.isArray(v)) return v.filter((x) => x !== "L").join(", ")
  return String(v).trim()
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** The categories a chart shows at most: past it, the smallest are one "Other". */
export const MAX_CATEGORIES = 30

/**
 * Rows grouped by label, in order of first appearance; each series is the
 * sum, the average or the count of its numbers in the group. Past
 * `MAX_CATEGORIES` labels, the largest by the first series stay and the rest
 * are one `other` category, aggregated from their numbers (not their totals).
 */
export function buildData(
  rows: readonly { label: unknown; values: readonly unknown[] }[],
  seriesCount: number,
  fn: Aggregate,
  blank: string,
  other = "Other",
): Datum[] {
  const groups = new Map<string, number[][]>()
  for (const r of rows) {
    const key = keyOf(r.label) || blank
    const g = groups.get(key) ?? Array.from({ length: seriesCount }, () => [])
    for (let i = 0; i < seriesCount; i++) {
      const n = num(r.values[i])
      if (n !== null) g[i]!.push(n)
    }
    groups.set(key, g)
  }
  const total = (nums: number[]) => (fn === "count" ? nums.length : nums.reduce((a, b) => a + b, 0))
  let entries = [...groups.entries()]
  if (entries.length > MAX_CATEGORIES) {
    const kept = new Set(
      [...entries]
        .sort(([, a], [, b]) => total(b[0] ?? []) - total(a[0] ?? []))
        .slice(0, MAX_CATEGORIES - 1)
        .map(([label]) => label),
    )
    const rest: number[][] = Array.from({ length: seriesCount }, () => [])
    for (const [label, g] of entries) if (!kept.has(label)) g.forEach((nums, i) => rest[i]!.push(...nums))
    entries = [...entries.filter(([label]) => kept.has(label)), [other, rest]]
  }
  return entries.map(([label, g]) => {
    const d: Datum = { label }
    g.forEach((nums, i) => {
      d[`s${i}`] = fn === "count" ? nums.length : fn === "average" ? (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0) : nums.reduce((a, b) => a + b, 0)
    })
    return d
  })
}

export function readSettings(options: Record<string, unknown> | null | undefined): { kind: ChartKind; fn: Aggregate } {
  const kind = KINDS.includes(options?.chart as ChartKind) ? (options!.chart as ChartKind) : "bar"
  const fn = AGGREGATES.includes(options?.aggregate as Aggregate) ? (options!.aggregate as Aggregate) : "sum"
  return { kind, fn }
}
