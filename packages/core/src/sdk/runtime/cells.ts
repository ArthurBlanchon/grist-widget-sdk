/**
 * Typed reads, with read-only access: each mapped cell checked against the
 * type its column declares in `GRIST_OPTIONS.columns`.
 *
 * Grist's mapping panel only offers the columns of the declared type, so for
 * a mapped column the declaration is the contract; and the plugin API's
 * decoded values already say what they are (a `Date`, a `Reference` with a
 * `rowId`, a list of ids, a `RaisedException` for a formula error, the raw
 * text of an invalid cell). Checked in Grist 1.7.22, every type, both
 * `cellFormat`s. So a cell is turned into the JS value its type promises, or
 * into `null` with an issue: no schema to fetch, no full access, no
 * dependency.
 */

import type { GristColumnsToMap, GristWidgetColumnMap } from "../types"

/** A mapped cell that didn't match its declared type, or a rule of the widget's schema. */
export type GristCellIssue = {
  rowId: number
  /** The declared column name, or "" for a schema rule on the whole record. */
  column: string
  message: string
  /** The value Grist sent. */
  value: unknown
}

/** What `checkGristCell` returns: the cell's value, or why it doesn't match its declared type. */
export type GristCellCheck = { ok: true; value: unknown } | { ok: false; message: string }

const ok = (value: unknown): GristCellCheck => ({ ok: true, value })
const bad = (message: string): GristCellCheck => ({ ok: false, message })

/** A formula error, as the plugin API decodes it (`RaisedException`) or encodes it (`["E", name, …]`). */
function formulaError(value: unknown): string | null {
  if (Array.isArray(value) && value[0] === "E") return String(value[1] ?? "error")
  if (value && typeof value === "object" && (value as { constructor?: { name?: string } }).constructor?.name === "RaisedException") {
    return String((value as { name?: unknown }).name ?? "error")
  }
  return null
}

function rowIdOf(value: unknown): number | null | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value === 0 ? null : value
  if (value && typeof value === "object" && typeof (value as { rowId?: unknown }).rowId === "number") {
    const id = (value as { rowId: number }).rowId
    return id === 0 ? null : id
  }
  if (Array.isArray(value) && value[0] === "R" && typeof value[2] === "number") return value[2] === 0 ? null : value[2]
  return undefined
}

function idsOf(value: unknown): number[] | undefined {
  if (value === null || value === undefined) return []
  const list = Array.isArray(value)
    ? value[0] === "L"
      ? value.slice(1)
      : value
    : value && typeof value === "object" && Array.isArray((value as { rowIds?: unknown }).rowIds)
      ? (value as { rowIds: unknown[] }).rowIds
      : undefined
  return list?.every((v) => typeof v === "number") ? (list as number[]) : undefined
}

function checkOne(base: string, value: unknown): GristCellCheck {
  switch (base) {
    case "Any":
      return ok(value)
    case "Text":
      return value === null || typeof value === "string" ? ok(value ?? "") : bad("not text")
    case "Numeric":
      return value === null || (typeof value === "number" && Number.isFinite(value)) ? ok(value) : bad("not a number")
    case "Int":
      return value === null || (typeof value === "number" && Number.isInteger(value)) ? ok(value) : bad("not an integer")
    case "Bool":
      return value === null || typeof value === "boolean" ? ok(value ?? false) : bad("not true or false")
    case "Date":
    case "DateTime":
      if (value === null) return ok(null)
      if (value instanceof Date && !Number.isNaN(value.getTime())) return ok(value)
      // Seconds since the epoch: Grist's "normal" format, and the emulator's raw rows.
      if (typeof value === "number" && Number.isFinite(value)) return ok(new Date(value * 1000))
      return bad("not a date")
    case "Choice":
      return value === null || typeof value === "string" ? ok(value) : bad("not a choice")
    case "ChoiceList": {
      if (value === null || value === undefined) return ok([])
      const list = Array.isArray(value) ? (value[0] === "L" ? value.slice(1) : value) : undefined
      return list?.every((v) => typeof v === "string") ? ok(list) : bad("not a list of choices")
    }
    case "Ref": {
      if (value === null) return ok(null)
      const id = rowIdOf(value)
      return id === undefined ? bad("not a reference") : ok(id)
    }
    case "RefList":
    case "Attachments": {
      const ids = idsOf(value)
      return ids === undefined ? bad(base === "RefList" ? "not a list of references" : "not a list of attachments") : ok(ids)
    }
    default:
      return ok(value)
  }
}

/**
 * `value` as its declared `type` promises ("Numeric", "Ref:Tasks",
 * "Text,Ref"…): a match of any listed type, or a failure that says why.
 * Without a type (or "Any"), the value as it is.
 */
/** The base types a declared type accepts: `"Text,Ref:People"` → `["Text", "Ref"]`. */
function basesOf(type: string | undefined): string[] {
  return (type ?? "Any")
    .split(",")
    .map((t) => t.trim().split(":")[0]!)
    .filter(Boolean)
}

export function checkGristCell(type: string | undefined, value: unknown): GristCellCheck {
  const error = formulaError(value)
  if (error) return bad(`formula error (${error})`)
  const bases = basesOf(type)
  if (bases.length === 0 || bases.includes("Any")) return ok(value === undefined ? null : value)
  let first: GristCellCheck | null = null
  for (const base of bases) {
    const check = checkOne(base, value)
    if (check.ok) return check
    first ??= check
  }
  return first!
}

const LIST_BASES = ["ChoiceList", "RefList", "Attachments"]

/**
 * A value as Grist stores it in a column of the declared `type`: the
 * reverse of what typed reads give. Lists become `["L", ...]` (a RefList's
 * `Reference` items become their row ids), a `Date` for a Date or DateTime
 * column becomes seconds since the epoch, a `Reference` for a Ref column its
 * row id. A list already encoded (`["L", ...]`, as the attachment helpers
 * return it) and every other value pass through, so it is safe to call twice.
 *
 * Grist's plugin API writes values as given: a bare array written to a
 * ChoiceList or RefList column is stored as an error cell. Checked in
 * Grist 1.7.22.
 */
export function encodeGristCell(type: string | undefined, value: unknown): unknown {
  if (value === null || value === undefined) return value
  const bases = basesOf(type)
  const accepts = (...names: string[]) => names.some((n) => bases.includes(n))
  if (value instanceof Date) return accepts("Date", "DateTime") ? Math.floor(value.getTime() / 1000) : value
  if (Array.isArray(value)) {
    if (!accepts(...LIST_BASES) || value[0] === "L") return value
    return ["L", ...value.map((item) => rowIdOf(item) ?? item)]
  }
  if (accepts("Ref") && typeof value === "object") return rowIdOf(value) ?? value
  return value
}

export const nameOf = (c: GristColumnsToMap[number]) => (typeof c === "string" ? c : c.name)
export const typeOf = (c: GristColumnsToMap[number]) => (typeof c === "string" ? undefined : c.type)
const isOptional = (c: GristColumnsToMap[number]) => typeof c === "object" && c.optional === true

/** Minimal Standard Schema (https://standardschema.dev): zod 4, valibot, arktype implement it. */
export type StandardSchema<T = unknown> = {
  readonly "~standard": {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown
    ) =>
      | { readonly value: T; readonly issues?: undefined }
      | { readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }
      | Promise<unknown>
  }
}

/**
 * A record under the widget's declared names, each cell checked against its
 * column's declared type, then the record against `schema` if given. Returns
 * null (no issues) while a required column isn't mapped, like Grist's
 * `mapColumnNames`; the record itself without declared columns.
 */
export function mapAndCheck<T>(
  record: Record<string, unknown> | null,
  columns: GristColumnsToMap | undefined,
  mappings: GristWidgetColumnMap | null,
  schema?: StandardSchema
): { value: T | null; issues: GristCellIssue[] } {
  if (!record) return { value: null, issues: [] }
  if (!columns?.length) return { value: record as T, issues: [] }
  if (mappings === null) return { value: null, issues: [] }
  const rowId = typeof record.id === "number" ? record.id : 0
  const out: Record<string, unknown> = { id: record.id }
  const issues: GristCellIssue[] = []
  for (const col of columns) {
    const name = nameOf(col)
    const real = mappings[name]
    const take = (raw: unknown) => {
      const check = checkGristCell(typeOf(col), raw)
      if (check.ok) return check.value
      issues.push({ rowId, column: name, message: check.message, value: raw })
      return null
    }
    if (Array.isArray(real) && real.length > 0) out[name] = real.map((r) => take(record[r]))
    else if (typeof real === "string" && real) out[name] = take(record[real])
    else if (!isOptional(col)) return { value: null, issues: [] }
  }
  if (schema) {
    const result = schema["~standard"].validate(out)
    if (result instanceof Promise) {
      issues.push({ rowId, column: "", message: "the schema validates asynchronously; useGrist() needs a synchronous one", value: out })
    } else if ("issues" in result && result.issues) {
      for (const issue of result.issues) {
        const key = issue.path?.[0]
        const column = key === undefined ? "" : String(typeof key === "object" ? key.key : key)
        issues.push({ rowId, column, message: issue.message, value: column ? out[column] : out })
      }
    } else if ("value" in result) {
      return { value: result.value as T, issues }
    }
  }
  return { value: out as T, issues }
}

// ---------------------------------------------------------------------------
// Types from a declaration
// ---------------------------------------------------------------------------

type BaseOf<T extends string> = T extends `${infer B}:${string}` ? B : T

type CellOf<T extends string> = T extends `${infer A},${infer Rest}`
  ? CellOf<A> | CellOf<Rest>
  : BaseOf<T> extends "Text"
    ? string
    : BaseOf<T> extends "Numeric" | "Int"
      ? number | null
      : BaseOf<T> extends "Bool"
        ? boolean
        : BaseOf<T> extends "Date" | "DateTime"
          ? Date | null
          : BaseOf<T> extends "Choice"
            ? string | null
            : BaseOf<T> extends "ChoiceList"
              ? string[]
              : BaseOf<T> extends "Ref"
                ? number | null
                : BaseOf<T> extends "RefList" | "Attachments"
                  ? number[]
                  : unknown

// Every checked cell is `| null`: a cell that doesn't match its declared type
// is null in mappedRecord (and listed in cellIssues), whatever the type.
type ColumnValue<C> = C extends { type: infer T extends string; allowMultiple: true }
  ? (CellOf<T> | null)[]
  : C extends { type: infer T extends string }
    ? CellOf<T> | null
    : C extends { allowMultiple: true }
      ? unknown[]
      : unknown

type RequiredName<C> = C extends { optional: true } ? never : C extends string ? C : C extends { name: infer N extends string } ? N : never
type OptionalName<C> = C extends { optional: true; name: infer N extends string } ? N : never
type ByName<Cs, N> = Extract<Cs, N | { name: N }>

/**
 * The mapped record a `GRIST_OPTIONS` declaration gives, for `useGrist`'s
 * second type argument. Declare the options with `as const satisfies
 * UseGristOptions` so the column names and types stay literal:
 *
 * ```ts
 * export const GRIST_OPTIONS = {
 *   requiredAccess: "read table",
 *   columns: [{ name: "Title", type: "Text" }, { name: "Due", type: "Date", optional: true }],
 * } as const satisfies UseGristOptions
 *
 * const w = useGrist<GristRowRecord, GristMappedRow<typeof GRIST_OPTIONS>>()
 * w.mappedRecord?.Due // Date | null | undefined
 * ```
 */
export type GristMappedRow<O extends { columns?: readonly unknown[] }> = O["columns"] extends readonly (infer C)[]
  ? { id: number } & { [N in RequiredName<C>]: ColumnValue<ByName<C, N>> } & { [N in OptionalName<C>]?: ColumnValue<ByName<C, N>> }
  : Record<string, unknown>
