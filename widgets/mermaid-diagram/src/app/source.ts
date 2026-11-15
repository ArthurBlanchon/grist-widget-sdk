/** Mermaid sources: a cell's, or a flowchart built from rows. */

export type Edge = { from: string; to: string; label: string }

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim())

/** A label as Mermaid reads it inside quotes: its own quotes and line breaks escaped. */
export function quote(label: string): string {
  return `"${label.replace(/"/g, "#quot;").replace(/\r?\n/g, " ")}"`
}

/**
 * A left-to-right flowchart with a node per distinct value of From and To,
 * and an arrow per row, labelled when the row has a label. Node ids are
 * generated (n0, n1…): a value never becomes Mermaid syntax.
 */
export function flowchart(rows: readonly { From?: unknown; To?: unknown; Label?: unknown }[]): { source: string; edges: number } {
  const ids = new Map<string, string>()
  const id = (name: string) => {
    let v = ids.get(name)
    if (!v) ids.set(name, (v = `n${ids.size}`))
    return v
  }
  const lines: string[] = []
  let edges = 0
  for (const r of rows) {
    const from = text(r.From)
    const to = text(r.To)
    if (!from) continue
    const a = id(from)
    if (!to) continue
    const b = id(to)
    const label = text(r.Label)
    lines.push(label ? `  ${a} -->|${quote(label)}| ${b}` : `  ${a} --> ${b}`)
    edges++
  }
  const nodes = [...ids].map(([name, v]) => `  ${v}[${quote(name)}]`)
  return { source: ["flowchart LR", ...nodes, ...lines].join("\n"), edges }
}
