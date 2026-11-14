/**
 * The template language: `{{Column}}` for a cell, `{{#rows}} … {{/rows}}`
 * for a section repeated per row. Cells are written as escaped text, so a
 * cell can never add markup; the template's own HTML is kept as written.
 */

export type Row = Record<string, unknown> & { id: number }

const PLACEHOLDER = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g
const SECTION = /\{\{#rows\}\}([\s\S]*?)\{\{\/rows\}\}/g

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)
}

/** A cell as text in `locale`: numbers and dates as the language writes them, lists joined. */
export function cellText(value: unknown, locale: string): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toLocaleDateString(locale, { timeZone: "UTC" })
  if (typeof value === "number") return new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(value)
  if (typeof value === "boolean") return value ? "✓" : ""
  if (Array.isArray(value)) return (value[0] === "L" ? value.slice(1) : value).map((v) => cellText(v, locale)).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function fill(part: string, row: Row | null, columns: ReadonlySet<string>, locale: string): string {
  return part.replace(PLACEHOLDER, (whole, name: string) =>
    row && columns.has(name) ? escapeHtml(cellText(row[name], locale)) : `<mark title="unknown column">${escapeHtml(whole)}</mark>`,
  )
}

/** The document's HTML: `row`'s cells in the placeholders, each of `rows` in the sections. */
export function render(template: string, row: Row | null, rows: readonly Row[], columns: ReadonlySet<string>, locale: string): string {
  const withSections = template.replace(SECTION, (_, inner: string) => rows.map((r) => fill(inner, r, columns, locale)).join(""))
  return fill(withSections, row, columns, locale)
}

export const hasSection = (template: string) => /\{\{#rows\}\}/.test(template)

/** The placeholders a template names. */
export function placeholders(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1]!))]
}

/** A template that shows every column as a table: the starting point. */
export function defaultTemplate(columns: readonly string[]): string {
  const lines = columns.map((c) => `    <tr><th>${escapeHtml(c)}</th><td>{{${c}}}</td></tr>`).join("\n")
  return `<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  th { text-align: left; padding-right: 1rem; }
</style>
<table>
${lines}
</table>
`
}

/**
 * The page the frame shows: the document, with a policy that loads nothing
 * but images and inline styles. Scripts don't run: the frame's sandbox has
 * no allow-scripts.
 */
export function page(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; font-src data:"></head><body>${body}</body></html>`
}
