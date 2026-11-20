import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Column } from "react-datasheet-grid"

import {
  ShadcnDataSheetGrid,
  type DataSheetGridProps,
} from "@/components/ui/ShadcnDataSheetGrid"

type RowWithOptionalId = { id?: number } & Record<string, unknown>

export type GristGridOperation = {
  type: "UPDATE" | "DELETE" | "CREATE"
  fromRowIndex: number
  toRowIndex: number
}

export type GristRdgGridColumn<RowT extends RowWithOptionalId> = {
  id: string
  column: Partial<Column<RowT, unknown, unknown>>
  minWidth?: number
}

export type GristRdgGridProps<RowT extends RowWithOptionalId> = {
  rows: RowT[]
  columns: GristRdgGridColumn<RowT>[]
  onChange: NonNullable<DataSheetGridProps<RowT>["onChange"]>
  onActiveRowIdChange?: (rowId: number) => void
  selectedRowId?: number | null
  invalidCellKeys?: ReadonlySet<string>
  height?: number
  rowHeight?: number
  autoAddRow?: boolean
  lockRows?: boolean
  className?: string
  footer?: React.ReactNode
}

export function GristRdgGrid<RowT extends RowWithOptionalId>({
  rows,
  columns,
  onChange,
  onActiveRowIdChange,
  selectedRowId,
  invalidCellKeys,
  height,
  rowHeight = 32,
  autoAddRow = false,
  lockRows = false,
  className,
  footer,
}: GristRdgGridProps<RowT>) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const resizeStateRef = useRef<{
    colId: string
    startX: number
    startWidth: number
  } | null>(null)

  const startColumnResize = useCallback(
    (e: React.PointerEvent, colId: string, minWidth: number) => {
      e.preventDefault()
      e.stopPropagation()
      const current = columnWidths[colId]
      const startWidth = typeof current === "number" ? current : minWidth
      resizeStateRef.current = {
        colId,
        startX: e.clientX,
        startWidth,
      }
    },
    [columnWidths]
  )

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = resizeStateRef.current
      if (!state) return
      const next = Math.max(70, state.startWidth + (e.clientX - state.startX))
      setColumnWidths((prev) => ({ ...prev, [state.colId]: next }))
    }
    const onUp = () => {
      resizeStateRef.current = null
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  const resolvedColumns = useMemo<Partial<Column<RowT, unknown, unknown>>[]>(
    () =>
      columns.map(({ id: colId, column, minWidth: explicitMinWidth }) => {
        const minWidth = explicitMinWidth ?? (colId === "id" ? 70 : 120)
        const hasCustomWidth = typeof columnWidths[colId] === "number"
        const basis = hasCustomWidth
          ? (columnWidths[colId] as number)
          : minWidth
        const existingCellClassName = column.cellClassName
        return {
          ...column,
          cellClassName: (opt: {
            rowData: RowT
            rowIndex: number
            columnId?: string
          }) => {
            const baseClass =
              typeof existingCellClassName === "function"
                ? (
                    existingCellClassName as (
                      arg: typeof opt
                    ) => string | undefined
                  )(opt)
                : (existingCellClassName ?? "")
            const isInvalid =
              typeof opt.rowData?.id === "number" &&
              Boolean(invalidCellKeys?.has(`${opt.rowData.id}:${colId}`))
            if (!isInvalid) return baseClass
            return baseClass
              ? `${baseClass} grist-invalid-number-cell`
              : "grist-invalid-number-cell"
          },
          minWidth,
          basis,
          grow: hasCustomWidth ? 0 : 1,
          shrink: hasCustomWidth ? 0 : 1,
          title: (
            <div className="relative flex h-full w-full items-center pr-3">
              <span className="block w-full truncate pr-2">
                {String(column.title ?? colId)}
              </span>
              <button
                type="button"
                aria-label={`Resize ${colId}`}
                className="absolute inset-y-0 right-0 w-2 cursor-col-resize bg-border/40 hover:bg-border"
                onPointerDown={(e) => startColumnResize(e, colId, minWidth)}
              />
            </div>
          ),
        } as Partial<Column<RowT, unknown, unknown>>
      }),
    [columns, columnWidths, invalidCellKeys, startColumnResize]
  )

  const handleActiveCellChange = useCallback(
    (opts: unknown) => {
      if (!onActiveRowIdChange) return
      const cell =
        typeof opts === "object" && opts !== null && "cell" in opts
          ? (opts as { cell?: { rowId?: unknown; row?: unknown } | null }).cell
          : (opts as { rowId?: unknown; row?: unknown } | null)
      if (!cell) return
      let rowId: number | null = null
      if (typeof cell.rowId === "number") {
        rowId = cell.rowId
      } else if (typeof cell.row === "number") {
        const row = rows[cell.row]
        rowId = typeof row?.id === "number" ? row.id : null
      }
      if (rowId === null || rowId === selectedRowId) return
      onActiveRowIdChange(rowId)
    },
    [onActiveRowIdChange, rows, selectedRowId]
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <style>{`.grist-invalid-number-cell{background:rgba(239,68,68,0.12)!important;}`}</style>
      <div className="min-h-0 flex-1 overflow-auto">
        <ShadcnDataSheetGrid<RowT>
          value={rows}
          columns={resolvedColumns}
          onChange={onChange}
          onActiveCellChange={handleActiveCellChange as never}
          rowKey="id"
          height={height}
          rowHeight={rowHeight}
          autoAddRow={autoAddRow}
          lockRows={lockRows}
          className={className}
        />
      </div>
      {footer ? (
        <p className="shrink-0 text-xs text-muted-foreground">{footer}</p>
      ) : null}
    </div>
  )
}
