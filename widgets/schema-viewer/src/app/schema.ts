import dagre from "@dagrejs/dagre"
import type { GristColumnInfo } from "grist-widget-sdk"

/** The document's tables and the references between them. */

export type Column = { colId: string; label: string; type: string; formula: string | null; ref: string | null; many: boolean }
export type Table = { id: string; columns: Column[] }
export type Link = { from: string; colId: string; label: string; to: string; many: boolean }
export type Schema = { tables: Table[]; links: Link[] }

export type Reader = {
  listTables: () => Promise<string[]>
  listColumns: (tableId: string) => Promise<GristColumnInfo[]>
}

export async function readSchema(api: Reader): Promise<Schema> {
  const ids = await api.listTables()
  const tables = await Promise.all(
    ids.map(async (id) => ({
      id,
      columns: (await api.listColumns(id)).map((c): Column => {
        const type = c.type ?? "Any"
        const m = /^(Ref|RefList):(.+)$/.exec(type)
        return { colId: c.colId, label: c.label || c.colId, type, formula: c.isFormula ? c.formula || "" : null, ref: m ? m[2]! : null, many: m?.[1] === "RefList" }
      }),
    })),
  )
  const known = new Set(ids)
  const links = tables.flatMap((t) => t.columns.filter((c) => c.ref && known.has(c.ref)).map((c) => ({ from: t.id, colId: c.colId, label: c.label, to: c.ref!, many: c.many })))
  return { tables, links }
}

/** Only `focus` and the tables it refers to or that refer to it. */
export function around(schema: Schema, focus: string | null): Schema {
  if (!focus) return schema
  const keep = new Set([focus])
  for (const l of schema.links) if (l.from === focus || l.to === focus) keep.add(l.from).add(l.to)
  return { tables: schema.tables.filter((t) => keep.has(t.id)), links: schema.links.filter((l) => keep.has(l.from) && keep.has(l.to)) }
}

export const ROW = 20
export const HEAD = 28
export const PAD = 10
/** An estimate of a text's width at the diagram's font size: it is laid out before it is drawn. */
const width = (s: string) => s.length * 7

export type Box = Table & { x: number; y: number; width: number; height: number }
export type Path = Link & { points: { x: number; y: number }[] }

/** Each table's box and each reference's path, laid out left to right. */
export function layout(schema: Schema): { boxes: Box[]; paths: Path[]; width: number; height: number } {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 72, marginx: 16, marginy: 16 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const t of schema.tables) {
    const w = Math.max(width(t.id) + 2 * PAD, ...t.columns.map((c) => width(c.label) + width(c.type) + 3 * PAD + 12))
    g.setNode(t.id, { width: Math.max(140, w), height: HEAD + t.columns.length * ROW + PAD })
  }
  schema.links.forEach((l, i) => {
    if (l.from !== l.to) g.setEdge(l.from, l.to, { width: width(l.label), height: 14 }, `e${i}`)
  })
  dagre.layout(g)
  const boxes = schema.tables.map((t) => {
    const n = g.node(t.id)
    return { ...t, x: n.x - n.width / 2, y: n.y - n.height / 2, width: n.width, height: n.height }
  })
  const byId = new Map(boxes.map((b) => [b.id, b]))
  const paths = schema.links.map((l, i): Path => {
    if (l.from === l.to) {
      // A table that refers to itself: a loop off its right side.
      const b = byId.get(l.from)!
      const r = b.x + b.width
      return { ...l, points: [{ x: r, y: b.y + HEAD / 2 }, { x: r + 24, y: b.y + HEAD / 2 }, { x: r + 24, y: b.y + HEAD + ROW }, { x: r, y: b.y + HEAD + ROW }] }
    }
    return { ...l, points: g.edge({ v: l.from, w: l.to, name: `e${i}` }).points ?? [] }
  })
  const info = g.graph()
  return { boxes, paths, width: (info.width ?? 0) + 32, height: info.height ?? 0 }
}

/** The schema in Markdown: what an AI needs to write formulas or widgets for the document. */
export function markdown(schema: Schema): string {
  const out: string[] = []
  for (const t of schema.tables) {
    out.push(`## ${t.id}`, "")
    for (const c of t.columns) {
      const name = c.label !== c.colId ? `\`${c.colId}\` (“${c.label}”)` : `\`${c.colId}\``
      const ref = c.ref ? `, ${c.many ? "references to rows of" : "a reference to a row of"} ${c.ref}` : ""
      const formula = c.formula !== null ? `, formula: \`${c.formula.replace(/\n/g, " ")}\`` : ""
      out.push(`- ${name}: ${c.type}${ref}${formula}`)
    }
    out.push("")
  }
  return out.join("\n").trim() + "\n"
}

const ident = (s: string) => s.replace(/[^A-Za-z0-9_]/g, "_")

/** The schema as a Mermaid entity-relationship diagram (for the Mermaid diagram widget, or an AI). */
export function mermaid(schema: Schema): string {
  const out = ["erDiagram"]
  for (const t of schema.tables) {
    out.push(`  ${ident(t.id)} {`)
    for (const c of t.columns) out.push(`    ${ident(c.type)} ${ident(c.colId)}${c.formula !== null ? ' "formula"' : ""}`)
    out.push("  }")
  }
  for (const l of schema.links) out.push(`  ${ident(l.from)} }o--${l.many ? "o{" : "o|"} ${ident(l.to)} : "${l.label.replace(/"/g, "'")}"`)
  return out.join("\n") + "\n"
}
