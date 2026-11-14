import type { ExpressionSpecification } from "maplibre-gl"

import type { Palette } from "./palette"

/** A country's fill: no value, then the theme's chart colours from low to the highest value. */
export function fillColor(maxCount: number, p: Palette): ExpressionSpecification {
  const max = Math.max(maxCount, 1)
  const q1 = Math.max(1, max * 0.25)
  const q2 = Math.max(q1 + 1, max * 0.5)
  const q3 = Math.max(q2 + 1, max * 0.75)
  return [
    "case",
    ["!=", ["coalesce", ["get", "hasCount"], 0], 1],
    p.none,
    ["interpolate", ["linear"], ["get", "count"], 0, p.scale[0], q1, p.scale[1], q2, p.scale[2], q3, p.scale[3], Math.max(q3 + 1, max), p.scale[4]],
  ]
}

export const fillOpacity = (): ExpressionSpecification => ["case", ["==", ["coalesce", ["get", "hasCount"], 0], 1], 0.92, 0.5]
export const outlineWidth = (): ExpressionSpecification => ["case", ["==", ["coalesce", ["get", "hasCount"], 0], 1], 1, 0.5]

/** The legend's gradient, in the same colours. */
export const legendGradient = (p: Palette) => `linear-gradient(to right, ${p.scale.join(", ")})`
