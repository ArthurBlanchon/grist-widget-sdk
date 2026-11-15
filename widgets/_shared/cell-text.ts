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
