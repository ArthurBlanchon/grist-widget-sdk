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

/** The categories a chart of unordered ones (customers, regions) shows at most: past it, the smallest are one "Other". */
export const MAX_CATEGORIES = 30
/** The points a chart of ordered categories (dates, numbers, a line) shows at most: past it, neighbours are put together. */
export const MAX_POINTS = 120

/** The kinds that draw categories in order, as a line does: their categories are never reordered or left out. */
export const ORDERED_KINDS: readonly ChartKind[] = ["line", "area", "combined"]

/**
 * Rows grouped by label, in order of first appearance; each series is the
 * sum, the average or the count of its numbers in the group. Every row
 * counts, however many categories there are:
 * - ordered categories (`ordered`, or every label a date or a number), past
 *   `MAX_POINTS`, are put together with their neighbours, in order, under
 *   "first – last";
 * - the others, past `MAX_CATEGORIES`, keep the largest (by the first
 *   series' value, sign aside) and put the rest in one `other` category, a
 *   category already named so included.
 * Put-together categories are aggregated from their rows' numbers: an
 * average stays an average of the rows.
 */
export function buildData(
  rows: readonly { label: unknown; values: readonly unknown[] }[],
  seriesCount: number,
  fn: Aggregate,
  blank: string,
  other = "Other",
  ordered = false,
): Datum[] {
  const groups = new Map<string, number[][]>()
  let datesOrNumbers = true
  for (const r of rows) {
    const key = keyOf(r.label) || blank
    if (keyOf(r.label) && !(r.label instanceof Date) && typeof r.label !== "number") datesOrNumbers = false
    let g = groups.get(key)
    if (!g) groups.set(key, (g = Array.from({ length: seriesCount }, () => [])))
    for (let i = 0; i < seriesCount; i++) {
      const n = num(r.values[i])
      if (n !== null) g[i]!.push(n)
    }
  }
  const value = (nums: number[]) =>
    fn === "count" ? nums.length : fn === "average" ? (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0) : nums.reduce((a, b) => a + b, 0)
  const merged = (list: (readonly [string, number[][]])[]) => Array.from({ length: seriesCount }, (_, i) => list.flatMap(([, g]) => g[i]!))
  let entries: (readonly [string, number[][]])[] = [...groups.entries()]

  if ((ordered || datesOrNumbers) && entries.length > MAX_POINTS) {
    const size = Math.ceil(entries.length / MAX_POINTS)
    const buckets: (readonly [string, number[][]])[] = []
    for (let i = 0; i < entries.length; i += size) {
      const run = entries.slice(i, i + size)
      buckets.push([run.length > 1 ? `${run[0]![0]} – ${run.at(-1)![0]}` : run[0]![0], merged(run)])
    }
    entries = buckets
  } else if (!(ordered || datesOrNumbers) && entries.length > MAX_CATEGORIES) {
    const ranked = entries.filter(([label]) => label !== other).sort(([, a], [, b]) => Math.abs(value(b[0] ?? [])) - Math.abs(value(a[0] ?? [])))
    const kept = new Set(ranked.slice(0, MAX_CATEGORIES - 1).map(([label]) => label))
    entries = [...entries.filter(([label]) => kept.has(label)), [other, merged(entries.filter(([label]) => !kept.has(label)))]]
  }
  return entries.map(([label, g]) => {
    const d: Datum = { label }
    g.forEach((nums, i) => {
      d[`s${i}`] = value(nums)
    })
    return d
  })
}

export function readSettings(options: Record<string, unknown> | null | undefined): { kind: ChartKind; fn: Aggregate } {
  const kind = KINDS.includes(options?.chart as ChartKind) ? (options!.chart as ChartKind) : "bar"
  const fn = AGGREGATES.includes(options?.aggregate as Aggregate) ? (options!.aggregate as Aggregate) : "sum"
  return { kind, fn }
}
