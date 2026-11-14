import { useCallback, useMemo, useState } from "react"

import { detectLocale, useT } from "@shared/i18n"
import { Map as MapCanvas, MapClusterLayer, MapControls, MapPopup } from "@shared/ui/map"

import { widget } from "./App"
import { legendGradient } from "./choropleth-scale"
import { byCategory, countsOf, pointsOf, type Point } from "./data"
import { messages } from "./messages"
import { usePalette } from "./palette"
import { WorldCountryLayer } from "./world-country-layer"

export default function MapView() {
  const w = widget.useGrist()
  const t = useT(messages)
  const locale = detectLocale()
  const palette = usePalette()
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale])
  const [open, setOpen] = useState<Point | null>(null)

  const mapped = (name: string) => Boolean(w.mappings[name])
  const mode = mapped("Latitude") && mapped("Longitude") ? "points" : mapped("Country") ? "countries" : null
  const rows = useMemo(() => w.mappedRecords ?? [], [w.mappedRecords])
  const hasValue = mapped("Value")

  const { points, skipped } = useMemo(() => pointsOf(rows), [rows])
  const groups = useMemo(() => byCategory(points), [points])
  const counts = useMemo(() => countsOf(rows, hasValue), [rows, hasValue])
  const valueLabel = useCallback((v: number) => t(hasValue ? "value" : "count", { value: number.format(v) }), [t, hasValue, number])

  if (!mode) {
    return <p className="m-auto flex h-svh max-w-sm items-center p-6 text-center text-sm text-muted-foreground">{t("howTo")}</p>
  }

  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const colour = (i: number) => palette.categories[i % palette.categories.length]!

  return (
    <main className="flex h-svh min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-sm">
        <div>
          <h1 className="font-medium">{t("title")}</h1>
          <p className="text-xs text-muted-foreground">
            {mode === "points" ? t("points", { n: number.format(points.length) }) : t("countries", { n: counts.size, total: number.format(total) })}
            {mode === "points" && skipped ? ` · ${t("skipped", { n: skipped })}` : ""}
          </p>
        </div>
        {mode === "points" && groups.length > 1 ? (
          <ul aria-label={t("legend")} className="flex flex-wrap gap-3 text-xs">
            {groups.map(([category], i) => (
              <li key={category} className="flex items-center gap-1">
                <span aria-hidden className="size-3 rounded-full" style={{ background: colour(i) }} />
                {category || t("noCategory")}
              </li>
            ))}
          </ul>
        ) : null}
        {mode === "countries" && total > 0 ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-label={t("legend")}>
            <span>{t("low")}</span>
            <span aria-hidden className="h-3 w-28 rounded-sm border" style={{ background: legendGradient(palette) }} />
            <span>{t("high")}</span>
          </div>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        <MapCanvas className="absolute inset-0" projection={mode === "countries" ? { type: "globe" } : undefined} center={[10, 30]} zoom={mode === "countries" ? 1.4 : 1.6}>
          {mode === "countries" ? <WorldCountryLayer counts={counts} palette={palette} valueLabel={valueLabel} /> : null}
          {mode === "points"
            ? groups.map(([category, list], i) => (
                <MapClusterLayer
                  key={`${category}:${colour(i)}`}
                  data={{
                    type: "FeatureCollection",
                    features: list.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] }, properties: { id: p.id } })),
                  }}
                  pointColor={colour(i)}
                  clusterColors={[colour(i), colour(i), colour(i)]}
                  onPointClick={(feature) => {
                    const id = Number(feature.properties?.id)
                    const point = list.find((p) => p.id === id)
                    if (!point) return
                    setOpen(point)
                    void w.setCursorPosition({ rowId: id })
                  }}
                />
              ))
            : null}
          {open ? (
            <MapPopup key={open.id} longitude={open.lon} latitude={open.lat} onClose={() => setOpen(null)} closeButton>
              <p className="text-sm font-medium">{open.label}</p>
              {open.category ? <p className="text-xs text-muted-foreground">{open.category}</p> : null}
            </MapPopup>
          ) : null}
          <MapControls showZoom showFullscreen position="bottom-right" />
        </MapCanvas>
      </div>
    </main>
  )
}
