import { useEffect, useState } from "react"

/**
 * The map's colours, from the shared theme. MapLibre paints with concrete
 * colours, not CSS variables, so each token is resolved in the page (and
 * again when Grist switches between light and dark): the map follows the
 * theme like every other widget.
 */
export type Palette = {
  /** The choropleth's scale, low to high: the theme's chart colours. */
  scale: [string, string, string, string, string]
  /** Countries without a value. */
  none: string
  border: string
  text: string
  halo: string
  /** A colour per point category, cycling. */
  categories: string[]
}

const TOKENS = {
  scale: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"],
  none: "--muted",
  border: "--border",
  text: "--foreground",
  halo: "--background",
} as const

/** What a token is when the page can't resolve it (no canvas, as in tests). */
const FALLBACK: Palette = {
  scale: ["gainsboro", "darkgray", "gray", "dimgray", "black"],
  none: "whitesmoke",
  border: "lightgray",
  text: "black",
  halo: "white",
  categories: ["gainsboro", "darkgray", "gray", "dimgray", "black"],
}

/** `var(--token)` as a hex colour MapLibre reads, or null. */
function resolve(token: string, ctx: CanvasRenderingContext2D | null): string | null {
  if (!ctx || typeof document === "undefined") return null
  const probe = document.createElement("span")
  probe.style.color = `var(${token})`
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return a ? `#${[r!, g!, b!].map((v) => v.toString(16).padStart(2, "0")).join("")}` : null
}

export function readPalette(): Palette {
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  } catch {
    ctx = null
  }
  const get = (token: string, fallback: string) => resolve(token, ctx) ?? fallback
  const scale = TOKENS.scale.map((t, i) => get(t, FALLBACK.scale[i]!)) as Palette["scale"]
  return {
    scale,
    none: get(TOKENS.none, FALLBACK.none),
    border: get(TOKENS.border, FALLBACK.border),
    text: get(TOKENS.text, FALLBACK.text),
    halo: get(TOKENS.halo, FALLBACK.halo),
    categories: [...scale].reverse(),
  }
}

/** The palette, read again whenever the page's theme class changes. */
export function usePalette(): Palette {
  const [palette, setPalette] = useState<Palette>(readPalette)
  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readPalette()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] })
    return () => observer.disconnect()
  }, [])
  return palette
}
