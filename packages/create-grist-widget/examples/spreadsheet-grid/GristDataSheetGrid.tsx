import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  checkGristCell,
  useGrist,
  type UseGristSchemaResult,
} from "grist-widget-sdk"

import {
  encodeRowFields,
  gristColumnToRdgColumn,
  writableColIds,
  type GristRdgRow,
} from "./grist-rdg-columns"
import { GristRdgGrid, type GristGridOperation } from "./GristRdgGrid"

export type GristDataSheetGridProps = {
  /**
   * Pre-fetched schema shared with other SDK consumers (e.g. toolbar), so
   * grid rendering and the cell checks use the same column metadata.
   */
  schema: UseGristSchemaResult
  /** RDG `height` — defaults to 500. */
  height?: number
  /** RDG `rowHeight` — defaults to 32. */
  rowHeight?: number
  /** RDG `autoAddRow`. Pressing Enter on the last row appends a new row. */
  autoAddRow?: boolean
  /** RDG `lockRows`. Hides "+ Add row" and disables row delete. */
  lockRows?: boolean
  /** Forwarded to `<ShadcnDataSheetGrid className=…>` for layout overrides. */
  className?: string
}

/**
 * The selected Grist section as a fully-synced spreadsheet.
 *
 * ## Why we don't read `useGrist().records`
 *
 * The SDK's `records` channel is wired to `grist.onRecords`, which under the
 * hood calls `viewApi.fetchSelectedTable`. In a real Grist Custom Widget
 * section, that endpoint returns **only the columns currently visible in the
 * section's view fields**. Sections start empty by default, so `records` rows
 * arrive with just `{id}` and our cells render blank.
 *
 * Instead we fetch table rows via `w.fetchRows(tableId, ...)`, which
 * always returns every column the table actually has — matching what
 * `useGristSchema()` reports, decoded with that schema; `checkGristCell` flags
 * the numeric cells Grist couldn't parse.
 *
 * ## Refresh triggers
 *
 * 1. `tableId` change (initial mount + section switch).
 * 2. `useGrist().records` arriving (used purely as a "section data changed"
 *    pulse — we ignore the row payload itself, but the SDK delivers this
 *    signal whenever the host posts `dataChange: true`, including for cell
 *    edits, row inserts/removes, and undo/redo).
 * 3. After our own writes settle (`actionStatus` returns to `"idle"`).
 * 4. Periodic 5 s backstop in case the host swallows a notification (this is
 *    cheap — `fetchRows` is a single round trip).
 *
 * ## Single source of truth
 *
 * `value` is read directly from the fetched rows state — no local copy of
 * unsaved edits. RDG holds the user's in-progress edit internally; once we
 * apply it via `table.update`, Grist round-trips and our next refresh shows
 * the canonical value. This avoids the merge logic of optimistic updates
 * while still feeling instant for typical typing latency.
 */
export function GristDataSheetGrid({
  schema,
  height,
  rowHeight = 32,
  autoAddRow = false,
  lockRows = false,
  className,
}: GristDataSheetGridProps) {
  const w = useGrist()
  const tableId = w.currentTableId
  const selectedRowId = typeof w.record?.id === "number" ? w.record.id : null
  const records = w.records
  const tableIdRef = useRef(tableId)
  useEffect(() => {
    tableIdRef.current = tableId
  }, [tableId])

  const schemaColumns = useMemo(
    () => schema.table?.columns ?? {},
    [schema.table]
  )
  // ---- Data: fetchRows(tableId), numeric cells checked ------------------------

  const fetchRows = w.fetchRows
  const [rowsState, setRowsState] = useState<{
    tableId: string
    rows: GristRdgRow[]
  } | null>(null)
  const [numericFormatIssueKeys, setNumericFormatIssueKeys] = useState<
    Set<string>
  >(() => new Set())

  // Latest schema columns, accessible from inside the async fetch without
  // adding it to the effect deps (we don't want to refetch just because
  // schema metadata changed — we'll re-decode the existing in-memory data via
  // the row mapping below).
  const schemaColumnsRef = useRef(schemaColumns)
  useEffect(() => {
    schemaColumnsRef.current = schemaColumns
  }, [schemaColumns])

  const refresh = useCallback(
    async (forTableId: string, signal: { cancelled: boolean }) => {
      try {
        const columns = schemaColumnsRef.current
        const rows = (await fetchRows<Record<string, unknown>>(forTableId, {
          columns,
          order: "grist",
        })) as GristRdgRow[]
        // A Numeric / Int cell Grist couldn't parse keeps its text: flag it.
        const numericKeys = new Set<string>()
        for (const row of rows) {
          for (const [colId, col] of Object.entries(columns)) {
            if (col.type !== "Int" && col.type !== "Numeric") continue
            if (!checkGristCell(col.type, row[colId]).ok) numericKeys.add(`${row.id}:${colId}`)
          }
        }
        if (signal.cancelled || forTableId !== tableIdRef.current) return
        setRowsState({ tableId: forTableId, rows })
        setNumericFormatIssueKeys(numericKeys)
      } catch (err) {
        if (signal.cancelled) return
        setNumericFormatIssueKeys(new Set())
        void err
      }
    },
    [fetchRows]
  )

  // 1) Refetch when `tableId` changes + 5s periodic backstop.
  useEffect(() => {
    if (!tableId) return
    const signal = { cancelled: false }
    void refresh(tableId, signal)
    const id = window.setInterval(() => {
      void refresh(tableId, signal)
    }, 5000)
    return () => {
      signal.cancelled = true
      window.clearInterval(id)
    }
  }, [tableId, refresh])

  // 2) Refetch on every `records` pulse from the SDK. We don't read the
  //    payload — we just react to the host telling us "the section's data
  //    changed". This catches cell edits, inserts, deletes, undo/redo
  //    initiated outside the widget.
  useEffect(() => {
    if (!tableId) return
    if (records === null) return
    const signal = { cancelled: false }
    void refresh(tableId, signal)
    return () => {
      signal.cancelled = true
    }
  }, [tableId, records, refresh])

  // 3) Refetch after our own writes settle, so the canonical row from Grist
  //    replaces RDG's optimistic in-progress state quickly.
  const actionStatus = w.actionStatus
  useEffect(() => {
    if (!tableId) return
    if (actionStatus !== "idle") return
    const signal = { cancelled: false }
    void refresh(tableId, signal)
    return () => {
      signal.cancelled = true
    }
  }, [tableId, actionStatus, refresh])

  // 4) Re-decode the in-memory rows when schema metadata content changes
  //    (e.g. column type changed via the toolbar). We use the *raw* fetched
  //    data we kept around, but since `rowsState` only stores decoded rows,
  //    we just trigger a refetch — cheap.
  useEffect(() => {
    if (!tableId) return
    const signal = { cancelled: false }
    void refresh(tableId, signal)
    return () => {
      signal.cancelled = true
    }
  }, [tableId, schemaColumns, refresh])

  // ---- Derive `value` and `columns` for RDG --------------------------------

  const rows = useMemo<GristRdgRow[]>(
    () =>
      rowsState && tableId && rowsState.tableId === tableId
        ? rowsState.rows
        : [],
    [rowsState, tableId]
  )
  // Keep a ref to the rows we last passed to RDG so we can resolve `DELETE`
  // operations (whose indices refer to the *old* value, per RDG's contract).
  const prevRowsRef = useRef<GristRdgRow[]>(rows)
  useEffect(() => {
    prevRowsRef.current = rows
  }, [rows])

  // Visible column ids: schema is the single source. We do NOT fall back to
  // `Object.keys(rows[0])` because `fetchRows` returns *every* column
  // (including system columns) and we want the schema's filtered ordering.
  const visibleColIds = useMemo<string[]>(
    () =>
      Object.keys(schemaColumns).filter(
        (colId) => !colId.startsWith("gristHelper_")
      ),
    [schemaColumns]
  )

  const columns = useMemo(
    () =>
      visibleColIds.map((colId) => {
        const col = gristColumnToRdgColumn(colId, schemaColumns[colId])
        return {
          id: colId,
          column: col,
          minWidth: colId === "id" ? 70 : 120,
        }
      }),
    [visibleColIds, schemaColumns]
  )
  const effectiveRowHeight = useMemo(() => {
    const hasChoiceList = visibleColIds.some(
      (colId) => schemaColumns[colId]?.type === "ChoiceList"
    )
    return hasChoiceList ? Math.max(rowHeight, 52) : rowHeight
  }, [rowHeight, schemaColumns, visibleColIds])

  const writable = useMemo(
    () => writableColIds(visibleColIds, schemaColumns),
    [visibleColIds, schemaColumns]
  )

  // ---- Schema reload triggers ----------------------------------------------
  //
  // Conservative — we never re-create the `columns` prop while the user is
  // editing on a row-only change:
  //   1. Selected table changes (initial mount + section switch).
  //   2. 5s backstop poll for external column add/remove/rename/retype.
  //   3. Toolbar mutations call `schema.reload()` directly.
  //   4. Manual "Reload" button in the toolbar.
  const reloadRef = useRef(schema.reload)
  useEffect(() => {
    reloadRef.current = schema.reload
  }, [schema.reload])

  useEffect(() => {
    if (!tableId) return
    const id = window.setInterval(() => void reloadRef.current(), 5000)
    return () => window.clearInterval(id)
  }, [tableId])

  // ---- Write-back: RDG onChange → Grist table ops --------------------------

  const handleChange = useCallback(
    (nextRows: GristRdgRow[], operations: GristGridOperation[]) => {
      if (!tableId) return
      const ops = w.table
      const oldRows = prevRowsRef.current

      const creates: Array<{ fields: Record<string, unknown> }> = []
      const updates: Array<{ id: number; fields: Record<string, unknown> }> = []
      const deletes: number[] = []

      for (const op of operations) {
        if (op.type === "CREATE") {
          for (let i = op.fromRowIndex; i < op.toRowIndex; i++) {
            const row = nextRows[i]
            if (!row) continue
            const fields = encodeRowFields(row, schemaColumns, writable)
            creates.push({ fields })
          }
        } else if (op.type === "UPDATE") {
          for (let i = op.fromRowIndex; i < op.toRowIndex; i++) {
            const row = nextRows[i]
            // The optimistic row created by RDG (before our `table.create`
            // round-trips) has no id yet; skip it — its UPDATE will arrive
            // again once the canonical row from Grist replaces it.
            if (typeof row?.id !== "number") continue
            const fields = encodeRowFields(row, schemaColumns, writable)
            updates.push({ id: row.id, fields })
          }
        } else if (op.type === "DELETE") {
          for (let i = op.fromRowIndex; i < op.toRowIndex; i++) {
            const row = oldRows[i]
            if (typeof row?.id === "number") deletes.push(row.id)
          }
        }
      }

      // Sequence: deletes → updates → creates. Errors are tracked by the SDK
      // and surfaced by the SDK's alerts (mountGristWidget).
      void (async () => {
        try {
          if (deletes.length > 0) await ops.destroy(deletes)
          if (updates.length > 0) await ops.update(updates)
          if (creates.length > 0) await ops.create(creates)
        } catch (err) {
          void err
        }
      })()
    },
    [tableId, w.table, schemaColumns, writable]
  )

  const handleActiveRowIdChange = useCallback(
    (rowId: number) => {
      void (async () => {
        try {
          await w.setCursorPosition({ rowId })
        } catch {
          // Some Grist hosts block cursor moves in specific linking setups;
          // fallback to linked-row selection when available.
          await w.setLinkedRowSelection([rowId])
        }
      })()
    },
    [w]
  )

  if (!tableId) {
    return (
      <p className="text-sm text-muted-foreground">
        Waiting for the selected section…
      </p>
    )
  }

  return (
    <GristRdgGrid<GristRdgRow>
      rows={rows}
      columns={columns}
      onChange={handleChange}
      onActiveRowIdChange={handleActiveRowIdChange}
      selectedRowId={selectedRowId}
      invalidCellKeys={numericFormatIssueKeys}
      height={height}
      rowHeight={effectiveRowHeight}
      autoAddRow={autoAddRow}
      lockRows={lockRows}
      className={className}
      footer={`Selected Grist row: ${selectedRowId ?? "none"}`}
    />
  )
}
