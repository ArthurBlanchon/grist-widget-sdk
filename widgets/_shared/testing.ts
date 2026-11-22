/**
 * The standard criterion AC-volume (ADR 0018): a widget renders 5,000 rows
 * with at most VOLUME_NODES DOM nodes. The rows are its demo data's, the
 * widget's table repeated to 5,000, in a document built as the demo's is:
 * every table, the demo's mapping (several columns under one declared
 * column included), references to their tables, cells as Grist stores them.
 */
import type { ReactElement } from "react"
import { expect } from "vitest"
import type { GristReplicaColumn, GristReplicaDocument, GristWidget, GristWidgetDemo, GristWidgetColumnMap } from "grist-widget-sdk"
import { renderWithGrist } from "grist-widget-sdk/emulator/testing"

/** The most DOM nodes a widget may make for VOLUME_ROWS rows. */
export const VOLUME_NODES = 3000
export const VOLUME_ROWS = 5000
/** A volume test's own timeout: a widget over budget takes long to render, and the count says by how much. */
export const VOLUME_TIMEOUT_MS = 60_000

/** The DOM nodes the page holds now. */
export const domNodes = (): number => document.body.getElementsByTagName("*").length

/**
 * The demo's document with its widget table's rows repeated to `count`, and
 * the mapping of the widget's declared columns to its columns.
 */
export type VolumeOptions = {
  /** The widget table's columns whose value is made distinct on every row: the worst case for a widget that groups by them. */
  unique?: string[]
  /** The widget options the section holds (a scale, a view) when the volume depends on them. */
  widgetOptions?: Record<string, unknown>
}

export function volumeDocument(
  widget: GristWidget,
  demo: GristWidgetDemo,
  count = VOLUME_ROWS,
  { unique = [] }: VolumeOptions = {},
): { document: GristReplicaDocument; mapping: GristWidgetColumnMap } {
  const tableId = demo.table ?? Object.keys(demo.tables)[0]
  if (!tableId || !demo.tables[tableId]) throw new Error(`volume: the demo has no table ${tableId ?? ""}`)
  if (demo.tables[tableId]!.rows.length === 0) throw new Error(`volume: the demo's table ${tableId} has no rows`)

  // Every column gets a colRef, so a reference shows its target's first column.
  let next = 1
  const colRefs = new Map<string, number>()
  for (const [t, table] of Object.entries(demo.tables)) for (const col of Object.keys(table.columns)) colRefs.set(`${t}.${col}`, next++)

  const tables: GristReplicaDocument["tables"] = {}
  for (const [t, table] of Object.entries(demo.tables)) {
    const columns: Record<string, GristReplicaColumn> = {}
    for (const [col, type] of Object.entries(table.columns)) {
      const target = /^(?:Ref|RefList):(.+)$/.exec(type)?.[1]
      const firstOfTarget = target ? Object.keys(demo.tables[target]?.columns ?? {})[0] : undefined
      const choices = table.choices?.[col]
      columns[col] = {
        type: type === "DateTime" ? "DateTime:UTC" : type,
        label: col,
        colRef: colRefs.get(`${t}.${col}`),
        ...(target && firstOfTarget ? { visibleColRef: colRefs.get(`${target}.${firstOfTarget}`) } : {}),
        ...(choices ? { widgetOptions: { choices } } : {}),
      }
    }
    const source = table.rows
    const length = t === tableId ? count : source.length
    tables[t] = {
      columns,
      rows: Array.from({ length }, (_, i) => {
        const row = source[i % source.length]!
        const out: Record<string, unknown> & { id: number } = { id: i + 1 }
        for (const [col, type] of Object.entries(table.columns)) {
          const value = stored(type, row[col])
          out[col] = t === tableId && unique.includes(col) ? `${value ?? ""} ${i + 1}`.trim() : value
        }
        return out
      }),
    }
  }

  const declared = (widget.options.columns ?? []).map((c) => (typeof c === "string" ? { name: c, allowMultiple: false } : c))
  const mapping: GristWidgetColumnMap = {}
  for (const c of declared) {
    const cols = demo.mapping?.[c.name] ?? (c.name in demo.tables[tableId]!.columns ? c.name : undefined)
    if (cols === undefined) continue
    mapping[c.name] = c.allowMultiple ? [cols].flat() : Array.isArray(cols) ? cols[0]! : cols
  }

  const document: GristReplicaDocument = {
    generatedAt: "1970-01-01T00:00:00.000Z",
    docName: "Volume",
    mode: "schema+data",
    tables,
    selection: { tableId, rowId: 1 },
    ...(demo.options ? { widgetOptions: demo.options } : {}),
  }
  return { document, mapping }
}

/** A demo cell as Grist stores it. */
function stored(type: string, value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (type === "Date" && typeof value === "string") return Date.parse(`${value}T00:00:00Z`) / 1000
  if (type.startsWith("DateTime") && typeof value === "string") return Date.parse(value) / 1000
  if (type === "Attachments") return null
  if ((type === "ChoiceList" || type.startsWith("RefList:")) && Array.isArray(value)) return value.length ? ["L", ...value] : null
  return value
}

/** The screens the SDK shows before a widget renders: counting them would measure nothing. */
const WAITING = ["Connecting to Grist", "Open inside Grist", "Something went wrong", "Map your columns"]

/** Whether the widget itself is on the page: some content, and none of the SDK's waiting screens. */
function widgetRendered(): boolean {
  for (const h of document.querySelectorAll('[role="status"] h2, [role="alert"] h2')) {
    if (WAITING.includes(h.textContent?.trim() ?? "")) return false
  }
  return domNodes() > 5 && (document.body.textContent?.trim().length ?? 0) > 0
}

/**
 * The DOM nodes once the widget has rendered and the page has stopped
 * changing for half a second; an error if it never renders.
 */
async function settledNodes(limitMs = VOLUME_TIMEOUT_MS - 5_000): Promise<number> {
  const until = Date.now() + limitMs
  let last = -1
  let steady = 0
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 100))
    if (!widgetRendered()) {
      steady = 0
      continue
    }
    const now = domNodes()
    steady = now === last ? steady + 1 : 0
    last = now
    if (steady >= 5) return now
  }
  if (last < 0) throw new Error(`volume: the widget didn't render within ${limitMs} ms`)
  return last
}

/**
 * AC-volume: `ui` (the widget) on its demo data's widget table repeated to
 * 5,000 rows renders with at most VOLUME_NODES DOM nodes. Give the test
 * VOLUME_TIMEOUT_MS: `it("AC-volume …", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)`.
 */
export async function expectVolume(ui: ReactElement, widget: GristWidget, demo: GristWidgetDemo, options: VolumeOptions = {}): Promise<number> {
  const { document, mapping } = volumeDocument(widget, demo, VOLUME_ROWS, options)
  const { emulator } = renderWithGrist(ui, {
    widget,
    emulator: { document, ...(options.widgetOptions ? { widgetOptions: options.widgetOptions } : {}) },
  })
  emulator.setColumnMappings(mapping)
  const nodes = await settledNodes()
  expect(nodes, `${nodes} DOM nodes for ${VOLUME_ROWS} rows; the budget is ${VOLUME_NODES} (ADR 0018)`).toBeLessThanOrEqual(VOLUME_NODES)
  return nodes
}
