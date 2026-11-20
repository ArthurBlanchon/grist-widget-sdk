import React, { memo } from "react"
import {
  type CellComponent,
  type CellProps,
  createTextColumn,
  keyColumn,
  textColumn,
  type Column,
} from "react-datasheet-grid"

import {
  encodeGristValue,
  normalizeGristChoiceListEntries,
  resolveGristFormulaKind,
  type GristReplicaColumn,
} from "grist-widget-sdk"

import {
  createGristChoiceColumn,
  createGristChoiceListColumn,
  createGristRefListColumn,
} from "./grist-rdg-choice-column"

/**
 * Decoded row shape exposed to react-datasheet-grid. `useGrist().records`
 * always carries a numeric `id` (it's the Grist row id), and the SDK already
 * decodes cell values via `keepEncoded: false`.
 */
export type GristRdgRow = Record<string, unknown> & { id?: number }

/**
 * Grist column types we let the schema toolbar create / change to.
 *
 * Refs / RefLists are intentionally excluded: they require a target table id
 * and a UX flow we don't want in the minimal demo.
 */
export const GRIST_TOOLBAR_COLUMN_TYPES = [
  "Text",
  "Numeric",
  "Int",
  "Bool",
  "Date",
  "DateTime",
  "Choice",
  "Any",
] as const

export type GristToolbarColumnType = (typeof GRIST_TOOLBAR_COLUMN_TYPES)[number]

function looksLikeDateTime(type: string | undefined): boolean {
  return (
    type === "DateTime" ||
    (typeof type === "string" && type.startsWith("DateTime:"))
  )
}

function looksLikeComplex(type: string | undefined): boolean {
  if (!type) return false
  return type === "Attachments"
}

function looksLikeRef(type: string | undefined): boolean {
  return typeof type === "string" && type.startsWith("Ref:")
}

function looksLikeRefList(type: string | undefined): boolean {
  return typeof type === "string" && type.startsWith("RefList:")
}

function isGristHelperColumnId(colId: string): boolean {
  return colId.startsWith("gristHelper_")
}

/** True for `computed` and `trigger` formulas — they cannot be written to. */
export function isFormulaColumn(col: GristReplicaColumn | undefined): boolean {
  if (!col) return false
  const kind = resolveGristFormulaKind(col)
  return kind === "computed" || kind === "trigger"
}

/** True for non-scalar column types we display as read-only JSON. */
export function isComplexColumn(col: GristReplicaColumn | undefined): boolean {
  return looksLikeComplex(col?.type)
}

function isDetailedRefValue(
  v: unknown
): v is { rowId: number; display?: string | null } {
  if (!v || typeof v !== "object") return false
  const rowId = (v as { rowId?: unknown }).rowId
  return typeof rowId === "number"
}

function chipStyle(ok: boolean): Record<string, string | number> {
  if (ok) {
    return {
      border: "1px solid #86efac",
      backgroundColor: "#f0fdf4",
      color: "#166534",
    }
  }
  return {
    border: "1px solid #dc2626",
    backgroundColor: "#fef2f2",
    color: "#991b1b",
  }
}

const RefChipCell = memo(function RefChipCell({
  rowData,
}: CellProps<unknown, unknown>) {
  let label = ""
  let ok = false
  if (isDetailedRefValue(rowData)) {
    const display =
      typeof rowData.display === "string" ? rowData.display.trim() : ""
    label = display !== "" ? display : String(rowData.rowId)
    ok = display !== ""
  } else if (typeof rowData === "number") {
    label = String(rowData)
    ok = false
  } else if (rowData != null) {
    label = String(rowData)
    ok = false
  }

  const children = label
    ? React.createElement(
        "span",
        {
          style: {
            borderRadius: 10,
            padding: "1px 6px",
            lineHeight: 1.4,
            ...chipStyle(ok),
          },
        },
        label
      )
    : null
  return React.createElement(
    "div",
    {
      className: "dsg-input",
      style: { pointerEvents: "none", minHeight: 22, padding: "2px 6px" },
    },
    children
  )
})

RefChipCell.displayName = "RefChipCell"

function refChipColumn(): Partial<Column<unknown, unknown, unknown>> {
  return {
    ...(textColumn as unknown as Partial<Column<unknown, unknown, unknown>>),
    component: RefChipCell as unknown as CellComponent<unknown, unknown>,
    disabled: true,
  }
}

/**
 * Build the set of writable column ids (we exclude formula and complex
 * columns from row writes — Grist would reject formula writes, and complex
 * columns need their own UX).
 */
export function writableColIds(
  colIds: readonly string[],
  schemaColumns: Record<string, GristReplicaColumn>
): Set<string> {
  const out = new Set<string>()
  for (const colId of colIds) {
    if (colId === "id") continue
    if (colId === "manualSort") continue
    if (isGristHelperColumnId(colId)) continue
    const col = schemaColumns[colId]
    if (isFormulaColumn(col)) continue
    if (isComplexColumn(col)) continue
    out.add(colId)
  }
  return out
}

function manualSortKey(row: GristRdgRow): number | null {
  const v = row.manualSort
  if (typeof v === "number" && !Number.isNaN(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return null
}

/**
 * Row order for Grist tables: `manualSort` ascending when present on any row,
 * otherwise numeric `id` (document order fallback).
 */
export function sortRowsByGristOrder(
  rows: readonly GristRdgRow[]
): GristRdgRow[] {
  const hasManual = rows.some((r) => manualSortKey(r) !== null)
  if (!hasManual) {
    return [...rows].sort((a, b) => {
      const ida = typeof a.id === "number" ? a.id : 0
      const idb = typeof b.id === "number" ? b.id : 0
      return ida - idb
    })
  }
  return [...rows].sort((a, b) => {
    const ma = manualSortKey(a)
    const mb = manualSortKey(b)
    if (ma !== null && mb !== null && ma !== mb) return ma - mb
    if (ma !== null && mb === null) return -1
    if (ma === null && mb !== null) return 1
    const ida = typeof a.id === "number" ? a.id : 0
    const idb = typeof b.id === "number" ? b.id : 0
    return ida - idb
  })
}

/**
 * Encode the writable subset of a row's fields back into Grist wire form.
 * Used for `table.create` / `table.update` payloads.
 */
export function encodeRowFields(
  row: Record<string, unknown>,
  schemaColumns: Record<string, GristReplicaColumn>,
  writable: ReadonlySet<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const colId of writable) {
    const value = row[colId]
    if (value === undefined) continue
    const type = schemaColumns[colId]?.type
    const encodedInput =
      typeof type === "string" &&
      type.startsWith("RefList:") &&
      value &&
      typeof value === "object" &&
      Array.isArray((value as { rowIds?: unknown }).rowIds)
        ? (value as { rowIds: number[] }).rowIds
        : value
    out[colId] = encodeGristValue(encodedInput, schemaColumns[colId])
  }
  return out
}

/** Read-only "complex" cell — JSON-stringified copy, no edit / paste. */
function complexDisplayColumn(): Partial<Column<unknown, unknown, string>> {
  return {
    ...(textColumn as Partial<Column<unknown, unknown, string>>),
    copyValue: ({ rowData }) =>
      rowData == null
        ? null
        : typeof rowData === "string"
          ? rowData
          : JSON.stringify(rowData),
    pasteValue: ({ rowData }) => rowData,
    deleteValue: ({ rowData }) => rowData,
  }
}

/**
 * DateTime variant of `textColumn` — values stay as `Date` objects (the SDK
 * decodes Grist DateTime cells to JS `Date`), and we display / parse ISO 8601.
 *
 * Native HTML `datetime-local` would be nicer but it's a bigger refactor; ISO
 * text is the lowest-friction path for the minimal widget.
 */
function dateTimeTextColumn() {
  return createTextColumn<Date | null>({
    placeholder: "YYYY-MM-DDTHH:mm:ssZ",
    parseUserInput: (raw) => {
      const s = raw.trim()
      if (!s) return null
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d
    },
    parsePastedValue: (raw) => {
      const s = raw.trim()
      if (!s) return null
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d
    },
    formatBlurredInput: (value) =>
      value instanceof Date ? value.toISOString() : "",
    formatInputOnFocus: (value) =>
      value instanceof Date ? value.toISOString() : "",
    formatForCopy: (value) =>
      value instanceof Date ? value.toISOString() : "",
  })
}

/**
 * Date variant that is resilient to malformed row values.
 *
 * RDG's built-in `dateColumn` assumes the cell value is always a `Date` and can
 * throw when a bad value leaks through (e.g. from malformed source data).
 * This column accepts Date/string/null and normalizes safely.
 */
function safeDateTextColumn() {
  return createTextColumn<Date | string | null>({
    placeholder: "YYYY-MM-DD",
    parseUserInput: (raw) => {
      const s = raw.trim()
      if (!s) return null
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d
    },
    parsePastedValue: (raw) => {
      const s = raw.trim()
      if (!s) return null
      const d = new Date(s)
      return Number.isNaN(d.getTime()) ? null : d
    },
    formatBlurredInput: (value) => {
      if (value == null) return ""
      if (value instanceof Date) return value.toISOString().slice(0, 10)
      if (typeof value === "string") return value
      return ""
    },
    formatInputOnFocus: (value) => {
      if (value == null) return ""
      if (value instanceof Date) return value.toISOString().slice(0, 10)
      if (typeof value === "string") return value
      return ""
    },
    formatForCopy: (value) => {
      if (value == null) return ""
      if (value instanceof Date) return value.toISOString().slice(0, 10)
      if (typeof value === "string") return value
      return ""
    },
  })
}

/**
 * Pick the right RDG column variant for a Grist column.
 *
 * The returned column is wrapped in `keyColumn(colId, ...)` so RDG reads /
 * writes the right key on the row object, and is marked `disabled` for
 * formula / complex / id columns.
 */
export function gristColumnToRdgColumn(
  colId: string,
  col: GristReplicaColumn | undefined
): Partial<Column<GristRdgRow, unknown, unknown>> {
  const label = col?.label || colId
  const type = col?.type
  const readOnly =
    colId === "id" ||
    isFormulaColumn(col) ||
    isComplexColumn(col) ||
    looksLikeRef(type)

  let base: Partial<Column<unknown, unknown, unknown>>
  if (isComplexColumn(col)) {
    base = complexDisplayColumn() as Partial<Column<unknown, unknown, unknown>>
  } else if (looksLikeRefList(type)) {
    base = createGristRefListColumn() as Partial<
      Column<unknown, unknown, unknown>
    >
  } else if (looksLikeRef(type)) {
    base = refChipColumn() as Partial<Column<unknown, unknown, unknown>>
  } else if (type === "Bool") {
    base = textColumn as Partial<Column<unknown, unknown, unknown>>
  } else if (type === "Int") {
    base = textColumn as Partial<Column<unknown, unknown, unknown>>
  } else if (type === "Numeric") {
    base = textColumn as Partial<Column<unknown, unknown, unknown>>
  } else if (type === "Date") {
    base = safeDateTextColumn() as Partial<Column<unknown, unknown, unknown>>
  } else if (looksLikeDateTime(type)) {
    base = dateTimeTextColumn() as Partial<Column<unknown, unknown, unknown>>
  } else if (type === "Choice") {
    const choiceEntries = normalizeGristChoiceListEntries(col?.widgetOptions)
    base =
      choiceEntries.length > 0
        ? (createGristChoiceColumn(choiceEntries) as Partial<
            Column<unknown, unknown, unknown>
          >)
        : (textColumn as Partial<Column<unknown, unknown, unknown>>)
  } else if (type === "ChoiceList") {
    const choiceEntries = normalizeGristChoiceListEntries(col?.widgetOptions)
    base = createGristChoiceListColumn(choiceEntries) as Partial<
      Column<unknown, unknown, unknown>
    >
  } else {
    base = textColumn as Partial<Column<unknown, unknown, unknown>>
  }

  return {
    ...keyColumn(colId, base as Partial<Column<unknown, unknown, unknown>>),
    id: colId,
    title: label,
    disabled: readOnly,
  } as Partial<Column<GristRdgRow, unknown, unknown>>
}
