import { memo, useLayoutEffect, useMemo, useRef } from "react"
import { useState } from "react"
import { X } from "lucide-react"
import type { CellComponent, CellProps, Column } from "react-datasheet-grid"
import { textColumn } from "react-datasheet-grid"

import type { GristChoiceListEntry } from "grist-widget-sdk"

export type GristRdgChoiceColumnData = { choices: GristChoiceListEntry[] }
export type GristRdgChoiceListColumnData = { choices: GristChoiceListEntry[] }
export type GristRdgRefListValue = { rowIds: number[]; displays?: string[] }

function matchPastedChoice(
  raw: string,
  choices: GristChoiceListEntry[]
): string | null {
  const t = raw.replace(/[\n\r]+/g, " ").trim()
  if (!t) return null
  const lower = t.toLowerCase()
  for (const c of choices) {
    if (c.value === t) return c.value
    if (c.label.toLowerCase() === lower) return c.value
  }
  return t
}

const ChoiceSelectCell = memo(function ChoiceSelectCell({
  active,
  focus,
  rowData,
  setRowData,
  stopEditing,
  disabled,
  columnData,
}: CellProps<string | null, GristRdgChoiceColumnData>) {
  const { choices } = columnData
  const selectRef = useRef<HTMLSelectElement>(null)
  const current = rowData == null || rowData === "" ? "" : String(rowData)
  const meta = choices.find((c) => c.value === current)

  useLayoutEffect(() => {
    if (focus && selectRef.current) {
      selectRef.current.focus()
    }
  }, [focus])

  if (focus && active) {
    return (
      <select
        ref={selectRef}
        className="dsg-input"
        style={{ width: "100%", pointerEvents: "auto" }}
        value={current}
        disabled={disabled}
        tabIndex={-1}
        onChange={(e) => {
          const v = e.target.value
          setRowData(v === "" ? null : v)
          stopEditing({ nextRow: false })
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            stopEditing({ nextRow: false })
          }
        }}
      >
        <option value="" />
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div
      className="dsg-input"
      style={{
        pointerEvents: "none",
        minHeight: 22,
        display: "flex",
        alignItems: "center",
        padding: "0 6px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {current ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: meta?.fillColor ?? "transparent",
            color: meta?.textColor ?? "inherit",
            borderRadius: 10,
            padding: "1px 6px",
            lineHeight: 1.4,
            border: meta ? "1px solid transparent" : "1px solid #dc2626",
          }}
        >
          {meta?.label ?? current}
        </span>
      ) : (
        ""
      )}
    </div>
  )
})

ChoiceSelectCell.displayName = "ChoiceSelectCell"

/**
 * react-datasheet-grid column for Grist `Choice` cells (string value + optional colors).
 */
export function createGristChoiceColumn(
  choices: GristChoiceListEntry[]
): Partial<Column<string | null, GristRdgChoiceColumnData, string>> {
  return {
    ...textColumn,
    component: ChoiceSelectCell as unknown as CellComponent<string | null, GristRdgChoiceColumnData>,
    columnData: { choices },
    copyValue: ({ rowData }) =>
      rowData == null || rowData === "" ? "" : String(rowData),
    pasteValue: ({ value }) => matchPastedChoice(value, choices),
    deleteValue: () => null,
    isCellEmpty: ({ rowData }) =>
      rowData === null || rowData === undefined || rowData === "",
  }
}

function parseChoiceListInput(
  raw: string,
  choices: GristChoiceListEntry[]
): string[] | null {
  const tokens = raw
    .split(",")
    .map((part) => matchPastedChoice(part, choices))
    .filter((part): part is string => Boolean(part && part.trim() !== ""))
  if (tokens.length === 0) return null
  return Array.from(new Set(tokens))
}

function normalizeChoiceListValue(
  value: string[] | string | null | undefined,
  choices: GristChoiceListEntry[]
): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === "string")
    return parseChoiceListInput(value, choices) ?? []
  return []
}

const ChoiceListCell = memo(function ChoiceListCell({
  active,
  focus,
  rowData,
  setRowData,
  stopEditing,
  disabled,
  columnData,
}: CellProps<string[] | null, GristRdgChoiceListColumnData>) {
  const { choices } = columnData
  const inputRef = useRef<HTMLInputElement>(null)
  const values = useMemo(
    () =>
      normalizeChoiceListValue(
        rowData as string[] | string | null | undefined,
        choices
      ),
    [choices, rowData]
  )
  const metaByValue = useMemo(
    () => new Map(choices.map((c) => [c.value, c])),
    [choices]
  )
  const [pendingText, setPendingText] = useState("")

  const setValues = (next: string[]) => {
    setRowData(next.length > 0 ? Array.from(new Set(next)) : null)
  }

  useLayoutEffect(() => {
    if (focus || active) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [focus, active])

  if (focus || active) {
    return (
      <div
        className="dsg-input"
        style={{ width: "100%", pointerEvents: "auto", padding: "2px 4px" }}
        onMouseDown={(e) => {
          // Keep the edit interaction owned by this cell, not the grid wrapper.
          e.stopPropagation()
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {values.map((v, index) => {
            const meta = metaByValue.get(v)
            const label = meta?.label ?? v
            const invalid = !meta
            return (
              <span
                key={`${v}-${index}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: meta?.fillColor ?? "transparent",
                  color: meta?.textColor ?? "inherit",
                  borderRadius: 10,
                  padding: "1px 4px 1px 6px",
                  lineHeight: 1.4,
                  border: invalid
                    ? "1px solid #dc2626"
                    : "1px solid transparent",
                }}
              >
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setValues(values.filter((_, i) => i !== index))
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    lineHeight: 1,
                    padding: 0,
                    color: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </span>
            )
          })}
          <input
            ref={inputRef}
            autoFocus
            size={Math.max(6, pendingText.length + 1)}
            style={{
              height: 28,
              width: "auto",
              minWidth: 48,
              maxWidth: 260,
              flex: "0 1 auto",
              display: "inline-flex",
              border: "none",
              outline: "none",
              background: "transparent",
            }}
            value={pendingText}
            disabled={disabled}
            placeholder="Type value, Enter to add"
            onChange={(e) => setPendingText(e.target.value)}
            onFocus={(e) => {
              e.stopPropagation()
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              window.setTimeout(() => inputRef.current?.focus(), 0)
            }}
            onKeyDown={(e) => {
              // Keep keyboard input inside the text field; RDG listens globally
              // and can steal these events before the input consumes them.
              e.stopPropagation()
              if (e.key === "Enter") {
                e.preventDefault()
                const next = pendingText.trim()
                if (next) {
                  setValues([...values, next])
                  setPendingText("")
                }
                stopEditing({ nextRow: false })
                return
              }
              if (e.key === "Escape") {
                e.stopPropagation()
                stopEditing({ nextRow: false })
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="dsg-input"
      style={{
        pointerEvents: "none",
        minHeight: 22,
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
        padding: "2px 6px",
      }}
    >
      {values.map((v, index) => {
        const meta = metaByValue.get(v)
        const label = meta?.label ?? v
        const invalid = !meta
        return (
          <span
            key={`${v}-${index}`}
            style={{
              backgroundColor: meta?.fillColor ?? "transparent",
              color: meta?.textColor ?? "inherit",
              borderRadius: 10,
              padding: "1px 6px",
              lineHeight: 1.4,
              border: invalid ? "1px solid #dc2626" : "1px solid transparent",
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
})

ChoiceListCell.displayName = "ChoiceListCell"

export function createGristChoiceListColumn(
  choices: GristChoiceListEntry[]
): Partial<Column<string[] | null, GristRdgChoiceListColumnData, string>> {
  return {
    component: ChoiceListCell as unknown as CellComponent<string[] | null, GristRdgChoiceListColumnData>,
    columnData: { choices },
    copyValue: ({ rowData }) =>
      Array.isArray(rowData) ? rowData.join(", ") : "",
    pasteValue: ({ value }) => parseChoiceListInput(value, choices),
    deleteValue: () => null,
    isCellEmpty: ({ rowData }) =>
      !Array.isArray(rowData) || rowData.length === 0,
  }
}

function normalizeRefListValue(
  value: GristRdgRefListValue | number[] | null | undefined
): GristRdgRefListValue {
  if (!value) return { rowIds: [], displays: [] }
  if (Array.isArray(value)) {
    return {
      rowIds: value.filter(
        (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0
      ),
      displays: [],
    }
  }
  if (typeof value === "object" && Array.isArray(value.rowIds)) {
    const rowIds = value.rowIds.filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0
    )
    const displays = Array.isArray(value.displays)
      ? value.displays.map((v) => String(v))
      : []
    return { rowIds, displays }
  }
  return { rowIds: [], displays: [] }
}

const RefListCell = memo(function RefListCell({
  active,
  focus,
  rowData,
  setRowData,
  stopEditing,
  disabled,
}: CellProps<GristRdgRefListValue | number[] | null, unknown>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const normalized = useMemo(
    () =>
      normalizeRefListValue(
        rowData as GristRdgRefListValue | number[] | null | undefined
      ),
    [rowData]
  )
  const rowIds = normalized.rowIds
  const displays = normalized.displays ?? []
  const [pendingText, setPendingText] = useState("")

  const setValues = (nextRowIds: number[], nextDisplays?: string[]) => {
    const ids = Array.from(
      new Set(
        nextRowIds.filter(
          (v) => typeof v === "number" && Number.isFinite(v) && v > 0
        )
      )
    )
    if (ids.length === 0) {
      setRowData(null)
      return
    }
    setRowData({
      rowIds: ids,
      displays: Array.isArray(nextDisplays) ? nextDisplays : [],
    } satisfies GristRdgRefListValue)
  }

  useLayoutEffect(() => {
    if (focus || active) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [focus, active])

  if (focus || active) {
    return (
      <div
        className="dsg-input"
        style={{ width: "100%", pointerEvents: "auto", padding: "2px 4px" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {rowIds.map((id, index) => {
            const display =
              typeof displays[index] === "string" ? displays[index].trim() : ""
            const label = display !== "" ? display : String(id)
            const ok = display !== ""
            return (
              <span
                key={`${id}-${index}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: ok ? "#f0fdf4" : "#fef2f2",
                  color: ok ? "#166534" : "#991b1b",
                  borderRadius: 10,
                  padding: "1px 4px 1px 6px",
                  lineHeight: 1.4,
                  border: ok ? "1px solid #86efac" : "1px solid #dc2626",
                }}
              >
                <span>{label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const nextIds = rowIds.filter((_, i) => i !== index)
                    const nextDisplays = displays.filter((_, i) => i !== index)
                    setValues(nextIds, nextDisplays)
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    lineHeight: 1,
                    padding: 0,
                    color: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </span>
            )
          })}
          <input
            ref={inputRef}
            autoFocus
            size={Math.max(6, pendingText.length + 1)}
            style={{
              height: 28,
              width: "auto",
              minWidth: 48,
              maxWidth: 220,
              flex: "0 1 auto",
              display: "inline-flex",
              border: "none",
              outline: "none",
              background: "transparent",
            }}
            value={pendingText}
            disabled={disabled}
            placeholder="Type ID, Enter to add"
            onChange={(e) => setPendingText(e.target.value)}
            onFocus={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              e.stopPropagation()
              window.setTimeout(() => inputRef.current?.focus(), 0)
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter") {
                e.preventDefault()
                const n = Number.parseInt(pendingText.trim(), 10)
                if (Number.isFinite(n) && n > 0) {
                  setValues([...rowIds, n], displays)
                  setPendingText("")
                }
                stopEditing({ nextRow: false })
                return
              }
              if (e.key === "Escape") {
                e.stopPropagation()
                stopEditing({ nextRow: false })
              }
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="dsg-input"
      style={{
        pointerEvents: "none",
        minHeight: 22,
        display: "flex",
        alignItems: "center",
        gap: 4,
        flexWrap: "wrap",
        padding: "2px 6px",
      }}
    >
      {rowIds.map((id, index) => {
        const display =
          typeof displays[index] === "string" ? displays[index].trim() : ""
        const label = display !== "" ? display : String(id)
        const ok = display !== ""
        return (
          <span
            key={`${id}-${index}`}
            style={{
              backgroundColor: ok ? "#f0fdf4" : "#fef2f2",
              color: ok ? "#166534" : "#991b1b",
              borderRadius: 10,
              padding: "1px 6px",
              lineHeight: 1.4,
              border: ok ? "1px solid #86efac" : "1px solid #dc2626",
            }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
})

RefListCell.displayName = "RefListCell"

export function createGristRefListColumn(): Partial<
  Column<GristRdgRefListValue | number[] | null, unknown, string>
> {
  return {
    component: RefListCell as unknown as CellComponent<GristRdgRefListValue | number[] | null, unknown>,
    copyValue: ({ rowData }) => {
      const normalized = normalizeRefListValue(
        rowData as GristRdgRefListValue | number[] | null | undefined
      )
      return normalized.rowIds.join(", ")
    },
    pasteValue: ({ value }) => {
      const ids = value
        .split(",")
        .map((token) => Number.parseInt(token.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
      if (ids.length === 0) return null
      return {
        rowIds: Array.from(new Set(ids)),
        displays: [],
      } satisfies GristRdgRefListValue
    },
    deleteValue: () => null,
    isCellEmpty: ({ rowData }) => {
      const normalized = normalizeRefListValue(
        rowData as GristRdgRefListValue | number[] | null | undefined
      )
      return normalized.rowIds.length === 0
    },
  }
}
