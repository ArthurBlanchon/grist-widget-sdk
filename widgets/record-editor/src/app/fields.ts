import { checkGristCell, encodeGristCell, type GristColumnInfo } from "grist-widget-sdk"

/** How a column is edited in the form. */
export type FieldKind = "text" | "longText" | "number" | "int" | "bool" | "date" | "datetime" | "choice" | "choiceList" | "ref" | "readonly"

export type Field = {
  colId: string
  label: string
  type: string
  kind: FieldKind
  choices: string[]
  /** Ref: the referenced table, and the column its cells show. */
  refTable?: string
  visibleCol?: string
  /** DateTime: the column's time zone. */
  timeZone: string
}

/** What a field holds while it is edited: text for boxes and lists, a flag, or the chosen choices. */
export type FormValue = string | boolean | string[]

const EDITABLE: Record<string, FieldKind> = {
  Text: "text",
  Any: "text",
  Numeric: "number",
  Int: "int",
  Bool: "bool",
  Date: "date",
  DateTime: "datetime",
  Choice: "choice",
  ChoiceList: "choiceList",
  Ref: "ref",
}

export function fieldOf(col: GristColumnInfo): Field {
  const type = col.type ?? "Any"
  const [base = "Any", ...rest] = type.split(":")
  const arg = rest.join(":")
  // An empty column is a formula column with no formula: Grist makes it a data column on the first entry.
  const formula = Boolean(col.isFormula && col.formula?.trim())
  let kind = formula ? "readonly" : (EDITABLE[base] ?? "readonly")
  if (kind === "text" && col.widgetOptions?.wrap === true) kind = "longText"
  const choices = Array.isArray(col.widgetOptions?.choices) ? col.widgetOptions.choices.filter((c): c is string => typeof c === "string") : []
  return {
    colId: col.colId,
    label: col.label?.trim() || col.colId,
    type,
    kind,
    choices,
    refTable: base === "Ref" || base === "RefList" ? arg : undefined,
    visibleCol: col.visibleCol,
    timeZone: base === "DateTime" && arg ? arg : "UTC",
  }
}

/** The cell as the form shows it. */
export function toForm(field: Field, raw: unknown): FormValue {
  const check = checkGristCell(field.kind === "readonly" ? undefined : field.type, raw)
  if (!check.ok) return display(raw)
  const v = check.value
  switch (field.kind) {
    case "bool":
      return v === true
    case "choiceList":
      return Array.isArray(v) ? v.map(String) : []
    case "date":
      return v instanceof Date ? v.toISOString().slice(0, 10) : ""
    case "datetime":
      return v instanceof Date ? wallClock(v, field.timeZone) : ""
    case "ref":
      return typeof v === "number" && v > 0 ? String(v) : ""
    case "readonly":
      return display(v)
    default:
      return v === null || v === undefined ? "" : typeof v === "string" ? v : display(v)
  }
}

export type Parsed = { ok: true; value: unknown } | { ok: false; error: "notNumber" | "notInteger" }

/** The form's value as the cell to write, encoded for the column's type. */
export function fromForm(field: Field, value: FormValue): Parsed {
  const text = typeof value === "string" ? value.trim() : ""
  let cell: unknown
  switch (field.kind) {
    case "number":
    case "int": {
      if (text === "") {
        cell = null
        break
      }
      const n = Number(text.replace(",", "."))
      if (!Number.isFinite(n)) return { ok: false, error: "notNumber" }
      if (field.kind === "int" && !Number.isInteger(n)) return { ok: false, error: "notInteger" }
      cell = n
      break
    }
    case "bool":
      cell = value === true
      break
    case "date":
      cell = text ? Date.UTC(+text.slice(0, 4), +text.slice(5, 7) - 1, +text.slice(8, 10)) / 1000 : null
      break
    case "datetime":
      cell = text ? fromWallClock(text, field.timeZone) / 1000 : null
      break
    case "choiceList":
      cell = Array.isArray(value) && value.length ? value : null
      break
    case "ref":
      // Grist's empty reference is row 0.
      cell = text ? Number(text) : 0
      break
    default:
      cell = typeof value === "string" ? value : ""
  }
  return { ok: true, value: encodeGristCell(field.type, cell) }
}

/** Any cell value as one line of text. */
export function display(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return (value[0] === "L" ? value.slice(1) : value).map(display).join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

const same = (a: FormValue, b: FormValue) => JSON.stringify(a) === JSON.stringify(b)
export { same as sameValue }

// Time zones. A DateTime is shown and entered as the clock reads in the column's zone.

function clockParts(t: number, timeZone: string): number[] {
  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return clockParts(t, "UTC")
  }
  const part = (type: string) => Number(fmt.formatToParts(t).find((p) => p.type === type)?.value)
  return [part("year"), part("month"), part("day"), part("hour"), part("minute")]
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0")

/** `2026-03-29T14:30` as the clock reads in `timeZone` at `date`. */
export function wallClock(date: Date, timeZone: string): string {
  const [y, mo, d, h, mi] = clockParts(date.getTime(), timeZone)
  return `${pad(y!, 4)}-${pad(mo!)}-${pad(d!)}T${pad(h!)}:${pad(mi!)}`
}

/** Milliseconds since the epoch of the moment the clock in `timeZone` reads `text` (`2026-03-29T14:30`). */
export function fromWallClock(text: string, timeZone: string): number {
  const [date = "", time = "00:00"] = text.split("T")
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const asUtc = Date.UTC(y!, mo! - 1, d!, h ?? 0, mi ?? 0)
  const offset = (t: number) => {
    const [py, pmo, pd, ph, pmi] = clockParts(t, timeZone)
    return Date.UTC(py!, pmo! - 1, pd!, ph!, pmi!) - Math.floor(t / 60_000) * 60_000
  }
  const first = asUtc - offset(asUtc)
  // Across a change of offset (summer time), the offset at the result is the one that holds.
  return asUtc - offset(first)
}
