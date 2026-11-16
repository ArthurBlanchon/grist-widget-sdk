import { mergeCountryCounts, normalizeCountryCode, type CountryCounts } from "./countries-geojson"

export type Point = { id: number; lon: number; lat: number; label: string; category: string }

const text = (v: unknown) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.filter((x) => x !== "L").join(", ") : String(v).trim())

/** A latitude or longitude within its range, or null. */
function coordinate(value: unknown, limit: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

type Row = { id: number; Latitude?: unknown; Longitude?: unknown; Label?: unknown; Category?: unknown; Country?: unknown; Value?: unknown }

/** The rows with valid coordinates, as points; the others are counted as skipped. */
export function pointsOf(rows: readonly Row[]): { points: Point[]; skipped: number } {
  const points: Point[] = []
  let skipped = 0
  for (const r of rows) {
    const lat = coordinate(r.Latitude, 90)
    const lon = coordinate(r.Longitude, 180)
    if (lat === null || lon === null) {
      skipped++
      continue
    }
    points.push({ id: r.id, lat, lon, label: text(r.Label) || `#${r.id}`, category: text(r.Category) })
  }
  return { points, skipped }
}

/** Each country's total: the Value column's sum, or a count of rows without one. */
export function countsOf(rows: readonly Row[], hasValue: boolean): CountryCounts {
  return mergeCountryCounts(
    rows.flatMap((r) => {
      const code = normalizeCountryCode(r.Country)
      if (!code) return []
      const n = hasValue ? (typeof r.Value === "number" && Number.isFinite(r.Value) ? r.Value : 0) : 1
      return [{ code, count: n }]
    }),
  )
}

/** The most categories the map colours and lists; past it, the smallest are one "other" group. */
export const MAX_CATEGORIES = 10

/** A category's points; `other` for the smallest categories put together. */
export type Category = { name: string; other: boolean; points: Point[] }

/**
 * Points by category, in order of first appearance. Past MAX_CATEGORIES,
 * the largest MAX_CATEGORIES - 1 keep their own and the rest are one group,
 * last: a legend and a layer per category stay readable and quick.
 */
export function byCategory(points: readonly Point[]): Category[] {
  const groups = new Map<string, Point[]>()
  for (const p of points) {
    const list = groups.get(p.category)
    if (list) list.push(p)
    else groups.set(p.category, [p])
  }
  const all = [...groups].map(([name, list]) => ({ name, other: false, points: list }))
  if (all.length <= MAX_CATEGORIES) return all
  const kept = new Set([...all].sort((a, b) => b.points.length - a.points.length).slice(0, MAX_CATEGORIES - 1))
  const rest = all.filter((c) => !kept.has(c)).flatMap((c) => c.points)
  return [...all.filter((c) => kept.has(c)), { name: "", other: true, points: rest }]
}
