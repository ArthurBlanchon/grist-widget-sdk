/** Text for matching: lower case, without accents, a value or a list of values joined. */
export function normalize(value: unknown): string {
  const text = Array.isArray(value) ? value.map(display).join(" ") : display(value)
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/** How a cell value reads as text. */
export function display(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "object") return ""
  return String(value)
}

/** Whether `query` (already normalized) occurs in any of `fields`. */
export const matches = (query: string, fields: readonly unknown[]): boolean =>
  query === "" || fields.some((f) => normalize(f).includes(query))
