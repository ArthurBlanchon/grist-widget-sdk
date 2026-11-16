/**
 * The standard criterion AC-volume (ADR 0018): a widget renders 5,000 rows
 * with at most VOLUME_NODES DOM nodes. The rows come from its demo data,
 * repeated, under its declared column names, as typed reads give them.
 */
import type { GristWidget, GristWidgetDemo } from "grist-widget-sdk"

/** The most DOM nodes a widget may make for VOLUME_ROWS rows. */
export const VOLUME_NODES = 3000
export const VOLUME_ROWS = 5000

/** The DOM nodes the page holds now. */
export const domNodes = (): number => document.body.getElementsByTagName("*").length

/**
 * `count` rows for `renderWithGrist(<App />, { widget, rows })`: the demo's
 * widget table's rows, round and round, each declared column taken from the
 * column the demo maps it to. A date becomes a `Date`; an attachments cell,
 * which names demo files, is left empty.
 */
export function volumeRows(widget: GristWidget, demo: GristWidgetDemo, count = VOLUME_ROWS): Record<string, unknown>[] {
  const tableId = demo.table ?? Object.keys(demo.tables)[0]!
  const table = demo.tables[tableId]!
  const declared = (widget.options.columns ?? []).map((c) => (typeof c === "string" ? { name: c, allowMultiple: false } : c))
  const source = (name: string) => {
    const mapped = demo.mapping?.[name] ?? name
    return Array.isArray(mapped) ? mapped : [mapped]
  }
  return Array.from({ length: count }, (_, i) => {
    const row = table.rows[i % table.rows.length]!
    const out: Record<string, unknown> = {}
    for (const c of declared) {
      const cells = source(c.name).map((col) => cellAs(table.columns[col], row[col]))
      out[c.name] = Array.isArray(demo.mapping?.[c.name]) || c.allowMultiple ? cells : cells[0]
    }
    return out
  })
}

function cellAs(type: string | undefined, value: unknown): unknown {
  if (type === "Attachments") return []
  if ((type === "Date" || type?.startsWith("DateTime")) && typeof value === "string") return new Date(value)
  return value
}
