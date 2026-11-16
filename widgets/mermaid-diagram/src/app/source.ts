/** Mermaid sources: a cell's, or a flowchart built from rows. */

export type Edge = { from: string; to: string; label: string }

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim())

/** A label as Mermaid reads it inside quotes: its own quotes and line breaks escaped. */
export function quote(label: string): string {
  return `"${label.replace(/"/g, "#quot;").replace(/\r?\n/g, " ")}"`
}

/** What Mermaid draws at most (its maxEdges and maxTextSize, kept as they are): past them it refuses the whole diagram. */
export const MAX_EDGES = 500
export const MAX_SOURCE = 50_000

/**
 * A left-to-right flowchart with a node per distinct value of From and To,
 * and an arrow per row, labelled when the row has a label. Node ids are
 * generated (n0, n1…): a value never becomes Mermaid syntax. It stops at
 * the arrows and the text Mermaid can draw; `rows` counts every row with an
 * arrow, `edges` the ones drawn.
 */
export function flowchart(rows: readonly { From?: unknown; To?: unknown; Label?: unknown }[]): { source: string; edges: number; rows: number } {
  const ids = new Map<string, string>()
  const id = (name: string) => {
    let v = ids.get(name)
    if (!v) ids.set(name, (v = `n${ids.size}`))
    return v
  }
  const lines: string[] = []
  let edges = 0
  let total = 0
  let size = "flowchart LR".length
  for (const r of rows) {
    const from = text(r.From)
    const to = text(r.To)
    if (!from) continue
    if (to) total++
    if (edges >= MAX_EDGES || size >= MAX_SOURCE) continue
    // The row's new nodes and its arrow, counted before they are added: past the text budget, the row is left out.
    const fresh = [from, to].filter((v) => v && !ids.has(v))
    const label = text(r.Label)
    const cost = fresh.reduce((n, v) => n + quote(v).length + 12, 0) + (to ? quote(label).length + 24 : 0)
    if (size + cost > MAX_SOURCE) {
      size = MAX_SOURCE
      continue
    }
    size += cost
    const a = id(from)
    if (!to) continue
    const b = id(to)
    lines.push(label ? `  ${a} -->|${quote(label)}| ${b}` : `  ${a} --> ${b}`)
    edges++
  }
  const nodes = [...ids].map(([name, v]) => `  ${v}[${quote(name)}]`)
  return { source: ["flowchart LR", ...nodes, ...lines].join("\n"), edges, rows: total }
}
