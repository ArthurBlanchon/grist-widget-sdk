import { cellText } from "@shared/cell-text"

/** Templates as text: `{{Column}}` is the row's cell, written as text. */

const PLACEHOLDER = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g

export type Row = Record<string, unknown> & { id: number }

/** The template with the row's cells in place; unknown names are kept as written, and listed. */
export function fill(template: string, row: Row, columns: ReadonlySet<string>, locale: string): { text: string; unknown: string[] } {
  const unknown = new Set<string>()
  const text = template.replace(PLACEHOLDER, (whole, name: string) => {
    if (columns.has(name)) return cellText(row[name], locale)
    unknown.add(name)
    return whole
  })
  return { text, unknown: [...unknown] }
}

/**
 * The cell's addresses, separated by commas, semicolons or line breaks.
 * Only plain addresses are kept: no spaces, and none of the characters
 * that would end an address in a link (`?`, `&`, `#`, `%`, `,`, `;`).
 */
export function recipients(value: unknown): string[] {
  const text = Array.isArray(value) ? value.filter((v) => v !== "L").join(",") : value === null || value === undefined ? "" : String(value)
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@?&#%,;<>"]+@[^\s@?&#%,;<>"]+\.[^\s@?&#%,;<>"]+$/.test(s))
}

export type Client = "mailto" | "gmail" | "outlook"

/** A link that opens the e-mail, ready to send, in the person's own client. */
export function link(client: Client, to: string[], subject: string, body: string): string {
  const q = (params: Record<string, string>) =>
    Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&")
  switch (client) {
    case "gmail":
      return `https://mail.google.com/mail/?${q({ view: "cm", fs: "1", to: to.join(","), su: subject, body })}`
    case "outlook":
      return `https://outlook.office.com/mail/deeplink/compose?${q({ to: to.join(","), subject, body })}`
    default:
      return `mailto:${to.join(",")}?${q({ subject, body: body.replace(/\r?\n/g, "\r\n") })}`
  }
}

/** Longer links than this are cut short by some e-mail clients. */
export const LONG_LINK = 2000

/** The first template, until one is saved: no placeholder, since the columns are the document's. */
export const DEFAULTS = {
  en: { subject: "Hello", body: "Hello,\n\n\n\nBest regards" },
  fr: { subject: "Bonjour", body: "Bonjour,\n\n\n\nBien cordialement" },
} as const
