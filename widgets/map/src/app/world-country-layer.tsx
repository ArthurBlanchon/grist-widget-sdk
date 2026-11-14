import * as MapLibreGL from "maplibre-gl"
import type { MapLayerMouseEvent } from "maplibre-gl"
import { useCallback, useEffect, useRef } from "react"

import { useMap } from "@shared/ui/map"
import { fillColor, fillOpacity, outlineWidth } from "./choropleth-scale"
import type { Palette } from "./palette"
import {
  COUNTRIES_GEOJSON_URL,
  enrichCountriesGeoJson,
  maxCountInCollection,
  type CountryCounts,
} from "./countries-geojson"

type WorldCountryLayerProps = {
  counts: CountryCounts
  palette: Palette
  /** The hover card's value line, e.g. `Value: {value}` in the person's language. */
  valueLabel: (value: number) => string
}

const SOURCE_ID = "map-countries"
const FILL_LAYER_ID = "map-countries-fill"
const LINE_LAYER_ID = "map-countries-outline"
const LABEL_LAYER_ID = "map-countries-labels"

function pickLabelFonts(map: MapLibreGL.Map): string[] {
  const layers = map.getStyle()?.layers ?? []
  for (const layer of layers) {
    if (layer.type !== "symbol") continue
    const font = layer.layout?.["text-font"]
    if (Array.isArray(font) && font.every((f) => typeof f === "string")) {
      return font as string[]
    }
  }
  return ["Open Sans Regular", "Arial Unicode MS Regular"]
}

export function WorldCountryLayer({ counts, palette, valueLabel }: WorldCountryLayerProps) {
  const { map, isLoaded } = useMap()
  const baseGeoJsonRef = useRef<GeoJSON.FeatureCollection | null>(null)
  const countsRef = useRef(counts)
  const paletteRef = useRef(palette)
  const labelRef = useRef(valueLabel)

  useEffect(() => {
    countsRef.current = counts
    paletteRef.current = palette
    labelRef.current = valueLabel
  }, [counts, palette, valueLabel])

  const applyPaint = useCallback((target: MapLibreGL.Map, maxCount: number) => {
    if (!target.getLayer(FILL_LAYER_ID)) return
    const p = paletteRef.current
    target.setPaintProperty(FILL_LAYER_ID, "fill-color", fillColor(maxCount, p))
    target.setPaintProperty(FILL_LAYER_ID, "fill-opacity", fillOpacity())
    if (target.getLayer(LINE_LAYER_ID)) {
      target.setPaintProperty(LINE_LAYER_ID, "line-color", p.border)
      target.setPaintProperty(LINE_LAYER_ID, "line-width", outlineWidth())
    }
    if (target.getLayer(LABEL_LAYER_ID)) {
      target.setPaintProperty(LABEL_LAYER_ID, "text-color", p.text)
      target.setPaintProperty(LABEL_LAYER_ID, "text-halo-color", p.halo)
    }
  }, [])

  const syncCountryData = useCallback((target: MapLibreGL.Map) => {
    const base = baseGeoJsonRef.current
    if (!base) return
    const enriched = enrichCountriesGeoJson(base, countsRef.current)
    const maxCount = maxCountInCollection(enriched)
    const source = target.getSource(SOURCE_ID) as MapLibreGL.GeoJSONSource | undefined
    source?.setData(enriched)
    applyPaint(target, maxCount)
  }, [applyPaint])

  useEffect(() => {
    if (!isLoaded || !map) return

    let cancelled = false

    void (async () => {
      if (!baseGeoJsonRef.current) {
        const res = await fetch(COUNTRIES_GEOJSON_URL)
        if (!res.ok) throw new Error(`Countries GeoJSON: ${res.status}`)
        baseGeoJsonRef.current = (await res.json()) as GeoJSON.FeatureCollection
      }
      if (cancelled) return

      if (!map.getSource(SOURCE_ID)) {
        const enriched = enrichCountriesGeoJson(
          baseGeoJsonRef.current,
          countsRef.current,
        )
        const maxCount = maxCountInCollection(enriched)

        map.addSource(SOURCE_ID, { type: "geojson", data: enriched })
        map.addLayer({
          id: FILL_LAYER_ID,
          type: "fill",
          source: SOURCE_ID,
          paint: {
            "fill-color": fillColor(maxCount, paletteRef.current),
            "fill-opacity": fillOpacity(),
          },
        })
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": paletteRef.current.border,
            "line-width": outlineWidth(),
          },
        })
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: ["==", ["coalesce", ["get", "hasCount"], 0], 1],
          layout: {
            "text-field": ["get", "countLabel"],
            "text-font": pickLabelFonts(map),
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              1,
              9,
              3,
              11,
              5,
              13,
            ],
            "text-allow-overlap": false,
            "text-optional": true,
            "text-padding": 2,
          },
          paint: {
            "text-color": paletteRef.current.text,
            "text-halo-color": paletteRef.current.halo,
            "text-halo-width": 2.25,
          },
        })
      } else {
        syncCountryData(map)
      }
    })().catch((err) => {
      console.error("[map] failed to load countries", err)
    })

    return () => {
      cancelled = true
    }
  }, [isLoaded, map, syncCountryData])

  useEffect(() => {
    if (!isLoaded || !map || !baseGeoJsonRef.current) return
    syncCountryData(map)
  }, [isLoaded, map, counts, syncCountryData])

  useEffect(() => {
    if (!isLoaded || !map || !baseGeoJsonRef.current) return
    const maxCount = maxCountInCollection(
      enrichCountriesGeoJson(baseGeoJsonRef.current, countsRef.current),
    )
    applyPaint(map, maxCount)
  }, [isLoaded, map, palette, applyPaint])

  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(FILL_LAYER_ID)) return

    const popup = new MapLibreGL.Popup({
      closeButton: false,
      closeOnClick: false,
    })

    const onMove = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) return
      const name = String(
        feature.properties?.NAME ?? feature.properties?.ADMIN ?? "",
      )
      const count = Number(feature.properties?.count ?? 0)
      map.getCanvas().style.cursor = "pointer"
      // Built as text nodes, never as HTML: the name comes from the map data, the value from the document.
      const card = document.createElement("div")
      card.className = "text-xs"
      const strong = document.createElement("strong")
      strong.textContent = name
      card.append(strong, document.createElement("br"), document.createTextNode(labelRef.current(count)))
      popup
        .setLngLat(e.lngLat)
        .setDOMContent(card)
        .addTo(map)
    }

    const onLeave = () => {
      map.getCanvas().style.cursor = ""
      popup.remove()
    }

    map.on("mousemove", FILL_LAYER_ID, onMove)
    map.on("mouseleave", FILL_LAYER_ID, onLeave)

    return () => {
      map.off("mousemove", FILL_LAYER_ID, onMove)
      map.off("mouseleave", FILL_LAYER_ID, onLeave)
      popup.remove()
    }
  }, [isLoaded, map])

  useEffect(() => {
    return () => {
      if (!map) return
      try {
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID)
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID)
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
      } catch {
        // ignore teardown races
      }
    }
  }, [map])

  return null
}
