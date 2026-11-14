/**
 * Natural Earth 110m (properties: ISO_A2, ISO_A3).
 * Vendored from natural-earth-vector — see `public/ne_110m_admin_0_countries.geojson`.
 */
export const COUNTRIES_GEOJSON_URL = `${import.meta.env.BASE_URL}ne_110m_admin_0_countries.geojson`

export type CountryCounts = ReadonlyMap<string, number>

export function normalizeCountryCode(raw: unknown): string | null {
  if (raw == null) return null
  const code = String(raw).trim().toUpperCase()
  if (!code || code === "-99") return null
  if (!/^[A-Z]{2,3}$/.test(code)) return null
  return code
}

export function mergeCountryCounts(
  rows: ReadonlyArray<{ code: string; count: number }>,
): CountryCounts {
  const out = new Map<string, number>()
  for (const { code, count } of rows) {
    if (!Number.isFinite(count)) continue
    out.set(code, (out.get(code) ?? 0) + count)
  }
  return out
}

export function countryCountEntry(
  props: GeoJSON.GeoJsonProperties,
  counts: CountryCounts,
): { count: number; hasValue: boolean } {
  if (!props) return { count: 0, hasValue: false }
  const iso2 = normalizeCountryCode(props.ISO_A2)
  const iso3 = normalizeCountryCode(props.ISO_A3)
  if (iso2 && counts.has(iso2)) {
    return { count: counts.get(iso2)!, hasValue: true }
  }
  if (iso3 && counts.has(iso3)) {
    return { count: counts.get(iso3)!, hasValue: true }
  }
  return { count: 0, hasValue: false }
}

export function enrichCountriesGeoJson(
  collection: GeoJSON.FeatureCollection,
  counts: CountryCounts,
): GeoJSON.FeatureCollection {
  const withCounts = collection.features.map((feature) => {
    const { count, hasValue } = countryCountEntry(feature.properties, counts)
    return { feature, count, hasValue }
  })
  const features = withCounts.map(({ feature, count, hasValue }) => {
    return {
      ...feature,
      properties: {
        ...feature.properties,
        count,
        hasCount: hasValue ? 1 : 0,
        countLabel: hasValue ? formatCountLabel(count) : "",
      },
    }
  })
  return {
    type: "FeatureCollection",
    features,
  }
}

export function formatCountLabel(count: number): string {
  if (!Number.isFinite(count)) return ""
  if (Math.abs(count) >= 1_000_000) {
    const compact = count / 1_000_000
    return `${compact >= 10 ? Math.round(compact) : compact.toFixed(1)}M`
  }
  if (Math.abs(count) >= 10_000) {
    const compact = count / 1_000
    return `${compact >= 100 ? Math.round(compact) : compact.toFixed(1)}k`
  }
  return count.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function maxCountInCollection(
  collection: GeoJSON.FeatureCollection,
): number {
  let max = 0
  for (const f of collection.features) {
    const c = Number(f.properties?.count ?? 0)
    if (c > max) max = c
  }
  return max
}
