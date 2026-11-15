import mermaid from "mermaid"

/** `var(--token)` as a hex colour: Mermaid's colour parser doesn't read the theme's oklch(). */
function hex(token: string, ctx: CanvasRenderingContext2D | null, fallback: string): string {
  if (!ctx) return fallback
  const probe = document.createElement("span")
  probe.style.color = `var(${token})`
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  probe.remove()
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = computed
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return a ? `#${[r!, g!, b!].map((n) => n.toString(16).padStart(2, "0")).join("")}` : fallback
}

/** The theme's colours as Mermaid's theme variables, read again at each render (light or dark). */
export function themeVariables(): Record<string, string> {
  let ctx: CanvasRenderingContext2D | null = null
  try {
    ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  } catch {
    ctx = null
  }
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => hex(name, ctx, name === "--foreground" || name === "--muted-foreground" ? "black" : "white")
  return {
    background: v("--background"),
    primaryColor: v("--secondary"),
    primaryTextColor: v("--foreground"),
    primaryBorderColor: v("--border"),
    lineColor: v("--muted-foreground"),
    secondaryColor: v("--muted"),
    tertiaryColor: v("--accent"),
    textColor: v("--foreground"),
    fontFamily: css.fontFamily,
  }
}

let count = 0

/**
 * The diagram's SVG, rendered in Mermaid's strict security mode: labels are
 * sanitised and click handlers are off. A syntax error rejects, with
 * Mermaid's message.
 */
export async function renderDiagram(source: string): Promise<string> {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    // Dagre lays every diagram out. ELK (elkjs, Mermaid 12's default) is not
    // shipped: its licence, EPL-2.0 or GPL-3.0, is off the catalog's allow
    // list (ADR 0015). Locking `layout` keeps a diagram's own front matter or
    // directive from asking for it.
    layout: "dagre",
    secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize", "suppressErrorRendering", "maxEdges", "layout"],
    theme: "base",
    themeVariables: themeVariables(),
    flowchart: { htmlLabels: false },
  })
  await mermaid.parse(source)
  const { svg } = await mermaid.render(`diagram-${++count}`, source)
  return svg
}

/** The SVG as a node, parsed as SVG (never as HTML), for the widget to show. */
export function svgNode(svg: string): Element | null {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
  const root = doc.documentElement
  return root.nodeName.toLowerCase() === "svg" ? document.importNode(root, true) : null
}
