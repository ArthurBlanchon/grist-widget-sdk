/**
 * `useGrist()`: the widget's one object for Grist — its connection, the
 * selected record and the section's records, column mapping, writes, widget
 * options, linking and the document's REST API.
 *
 * It reads the connection of the `<GristWidgetProvider>` above it (what
 * `mountGristWidget()` renders), and throws outside one: `useGristOptional()`
 * returns `null` there instead.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react"

import type { ValidateColumnMappingsResult } from "./helpers/grist-mappings"
import { createGristApi, type GristApi } from "./runtime/api"
import {
  deriveColumnMappingStatus,
  deriveError,
  deriveStatus,
  mapBackPatch,
  type GristWidgetStatus,
} from "./runtime/derive"
import { mapAndCheck, type GristCellIssue } from "./runtime/cells"
import { ALL_STREAMS } from "./runtime/host"
import { resetGristReady } from "./runtime/ready"
import {
  createGristRuntime,
  initialRuntimeState,
  type GristRuntime,
  type GristRuntimeOptions,
  type GristRuntimeState,
  type GristTheme,
  type GristWidgetActionStatus,
} from "./runtime/runtime"
import type { GristRowRecord, GristWidgetColumnMap } from "./types"

export type { GristTheme, GristWidgetActionStatus, GristWidgetStatus }
export type { FetchRows, FetchRowsOptions, GristColumnInfo, ListColumnsOptions, ListTablesOptions } from "./runtime/api"

/** What the widget asks Grist for: access, columns to map, and the alerts it doesn't want. */
export type UseGristOptions = GristRuntimeOptions

/** A write under declared names: any of the mapped record's fields but its `id`. */
export type GristRecordPatch<TMapped> = Partial<Omit<TMapped, "id">>

/** Derived from the selection: no row, a row, or the add-row placeholder. */
export type GristWidgetMode = "empty" | "row" | "new-row"

/**
 * The widget's Grist state and API. Every method is referentially stable for
 * the widget's lifetime: safe in effect dependencies. The object itself is
 * new whenever a value changes; depend on the members you use, not on it.
 */
export type UseGristResult<TRow = Record<string, unknown>, TMapped = Record<string, unknown>> = GristApi & {
  /** `"booting"` until Grist answers, then `"ready"`; `"unavailable"` outside Grist; `"error"` otherwise. */
  status: GristWidgetStatus
  /** Why the widget can't run (status `"error"` or `"unavailable"`), else null. */
  error: string | null
  /** Grist's light or dark theme, null until Grist sends it. */
  theme: GristTheme | null

  /** The selected row, raw column ids. */
  record: GristRowRecord<TRow> | null
  /** The section's rows (what its filters show), raw column ids. */
  records: GristRowRecord<TRow>[] | null
  /**
   * The selected row under the declared column names, each cell the JS value
   * its declared type promises (a cell that doesn't match is null, and in
   * `cellIssues`); null until every required column is mapped.
   */
  mappedRecord: TMapped | null
  /** Every row of the section, like `mappedRecord`. */
  mappedRecords: TMapped[] | null
  /** The mapped cells that didn't match their declared type (or the widget's `schema`), by row. */
  cellIssues: readonly GristCellIssue[]
  /** Declared column name → the Grist column id(s) mapped to it. */
  mappings: GristWidgetColumnMap
  /** Whether every required declared column is mapped (`pending` until Grist reports mappings). */
  columnMappingStatus: ValidateColumnMappingsResult
  mode: GristWidgetMode
  /** The Grist column id mapped to a declared name, or the name itself. */
  resolveMappedColumnId: (name: string) => string
  /**
   * A patch under declared names, as real column ids for a write, each value
   * encoded for its declared type (multi-column mappings are skipped).
   */
  mapBack: (patch: Partial<TMapped>) => Record<string, unknown>
  /**
   * Writes a patch under declared names to the selected row (or to `rowId`),
   * encoded for each declared type: `mapBack` + `table.update` in one call.
   * Rejects when no row is selected.
   */
  updateRecord: {
    (patch: GristRecordPatch<TMapped>): Promise<void>
    (rowId: number, patch: GristRecordPatch<TMapped>): Promise<void>
  }
  /** Adds a row to the section's table from a patch under declared names; resolves to its row id. */
  addRecord: (patch: GristRecordPatch<TMapped>) => Promise<number>
  /** The section's table id. */
  currentTableId: string | null

  /** The last write's state. */
  actionStatus: GristWidgetActionStatus
  actionError: string | null

  /** The options Grist stores for this widget, null until it sends them. */
  widgetOptions: Record<string, unknown> | null
}

type GristContextValue = { runtime: GristRuntime; api: GristApi }

const GristContext = createContext<GristContextValue | null>(null)
GristContext.displayName = "GristContext"

/** @internal The provider's (or the page's) runtime, for the SDK's own components. */
export function useGristRuntime(): GristContextValue | null {
  return useContext(GristContext)
}

function newConnection(options: UseGristOptions | undefined): GristContextValue {
  const runtime = createGristRuntime(options)
  return { runtime, api: createGristApi(runtime) }
}

/** @internal Tests: forget every Grist binding. */
export function resetGristForTests(): void {
  resetGristReady()
  for (const s of ALL_STREAMS) s.reset()
}

export const GristContextProvider = GristContext.Provider
export { newConnection }

const serverState = () => initialRuntimeState()

/** The connection's state, re-rendering on every change. */
export function useGristState(connection: GristContextValue): GristRuntimeState {
  const { runtime } = connection
  useEffect(() => runtime.start(), [runtime])
  return useSyncExternalStore(runtime.subscribe, runtime.getState, serverState)
}

type Mapped<TMapped> = { record: TMapped | null; records: TMapped[] | null; issues: readonly GristCellIssue[] }

const NO_ISSUES: readonly GristCellIssue[] = Object.freeze([])

/** The mapped, checked record and records; recomputed only when they, the mappings or the options change. */
function useMapped<TMapped>(state: GristRuntimeState, options: GristRuntimeOptions): Mapped<TMapped> {
  const { record, records, mappings } = state
  const { columns, schema } = options
  return useMemo(() => {
    const issues: GristCellIssue[] = []
    const rows =
      records && (columns?.length ? mappings !== null : true)
        ? records.map((r) => {
            const out = mapAndCheck<TMapped>(r, columns, mappings, schema)
            issues.push(...out.issues)
            return out.value
          })
        : null
    const selected = mapAndCheck<TMapped>(record, columns, mappings, schema)
    if (record && !records?.some((r) => r.id === record.id)) issues.push(...selected.issues)
    const mappedRecords = rows && rows.every((r) => r !== null) ? (rows as TMapped[]) : null
    return { record: selected.value, records: mappedRecords, issues: issues.length ? issues : NO_ISSUES }
  }, [record, records, mappings, columns, schema])
}

type RecordWrites = Pick<UseGristResult, "updateRecord" | "addRecord">

/** `updateRecord` / `addRecord`: stable, reading the mappings and the selection when called. */
function recordWrites(connection: GristContextValue): RecordWrites {
  const { runtime, api } = connection
  const fieldsOf = (patch: Record<string, unknown>) => {
    const { id: _id, ...rest } = patch
    return mapBackPatch(rest, runtime.getState().mappings ?? EMPTY_MAPPINGS, runtime.options.columns).fields
  }
  const updateRecord = ((a: number | Record<string, unknown>, b?: Record<string, unknown>) => {
    const rowId = typeof a === "number" ? a : runtime.getState().record?.id
    const patch = typeof a === "number" ? (b ?? {}) : a
    if (typeof rowId !== "number") {
      return Promise.reject(new Error("updateRecord(): no row is selected. Pass the row id: updateRecord(rowId, patch)."))
    }
    return api.table.update({ id: rowId, fields: fieldsOf(patch) })
  }) as RecordWrites["updateRecord"]
  const addRecord = async (patch: Record<string, unknown>) => {
    const created = await api.table.create({ fields: fieldsOf(patch) })
    return (Array.isArray(created) ? created[0]! : created).id
  }
  return { updateRecord, addRecord }
}

function buildResult<TRow, TMapped>(
  state: GristRuntimeState,
  mapped: Mapped<TMapped>,
  connection: GristContextValue,
  mapBack: (patch: Partial<TMapped>) => Record<string, unknown>,
  resolveMappedColumnId: (name: string) => string,
  writes: RecordWrites
): UseGristResult<TRow, TMapped> {
  const { runtime, api } = connection
  const status = deriveStatus(state)
  const columns = runtime.options.columns
  const result = {
    ...api,
    status,
    error: deriveError(state),
    theme: state.theme,
    record: state.record as GristRowRecord<TRow> | null,
    records: state.records as GristRowRecord<TRow>[] | null,
    mappedRecord: mapped.record,
    mappedRecords: mapped.records,
    cellIssues: mapped.issues,
    mappings: state.mappings ?? EMPTY_MAPPINGS,
    columnMappingStatus: deriveColumnMappingStatus(columns, state.mappings),
    mode: state.isNewRecord ? "new-row" : state.record ? "row" : "empty",
    resolveMappedColumnId,
    mapBack,
    updateRecord: writes.updateRecord as UseGristResult<TRow, TMapped>["updateRecord"],
    addRecord: writes.addRecord as UseGristResult<TRow, TMapped>["addRecord"],
    currentTableId: state.currentTableId,
    actionStatus: state.actionStatus,
    actionError: state.actionError,
    widgetOptions: state.widgetOptions,
  } as UseGristResult<TRow, TMapped>
  return result
}

const EMPTY_MAPPINGS: GristWidgetColumnMap = Object.freeze({}) as GristWidgetColumnMap

function useGristResult<TRow, TMapped>(connection: GristContextValue): UseGristResult<TRow, TMapped> {
  const state = useGristState(connection)
  const mappings = state.mappings ?? EMPTY_MAPPINGS
  const { runtime } = connection
  const resolveMappedColumnId = useCallback(
    (name: string) => {
      const real = mappings[name]
      if (typeof real === "string" && real) return real
      if (Array.isArray(real) && typeof real[0] === "string") return real[0]
      return name
    },
    [mappings]
  )
  const mapBack = useCallback(
    (patch: Partial<TMapped>) => {
      const { fields, skipped } = mapBackPatch(patch as Record<string, unknown>, mappings, runtime.options.columns)
      const previous = runtime.getState().mapBackSkipped
      if (previous.join("\0") !== skipped.join("\0")) runtime.update({ mapBackSkipped: skipped })
      return fields
    },
    [mappings, runtime]
  )
  const mapped = useMapped<TMapped>(state, runtime.options)
  const writes = useMemo(() => recordWrites(connection), [connection])
  return useMemo(
    () => buildResult<TRow, TMapped>(state, mapped, connection, mapBack, resolveMappedColumnId, writes),
    [state, mapped, connection, mapBack, resolveMappedColumnId, writes]
  )
}

/**
 * The widget's Grist state and API, from the nearest `<GristWidgetProvider>`:
 * `mountGristWidget()` renders one inside Grist, and `renderWithGrist(<App />,
 * { widget })` in a test. Throws outside one; a component that also runs
 * outside Grist calls `useGristOptional()`.
 */
export function useGrist<TRow = Record<string, unknown>, TMapped = Record<string, unknown>>(): UseGristResult<TRow, TMapped> {
  const fromProvider = useContext(GristContext)
  if (!fromProvider) {
    throw new Error(
      "useGrist() must be used inside <GristWidgetProvider>: mountGristWidget() renders one, and in a test " +
        "renderWithGrist(<App />, { widget }) does. A component that also runs outside Grist calls useGristOptional()."
    )
  }
  return useGristResult<TRow, TMapped>(fromProvider)
}

/** `useGrist()` inside a provider, or null outside one: for components that also work without Grist. */
export function useGristOptional<TRow = Record<string, unknown>, TMapped = Record<string, unknown>>(): UseGristResult<
  TRow,
  TMapped
> | null {
  const fromProvider = useContext(GristContext)
  // The hooks below run in both branches; the provider only decides which connection they read.
  const result = useGristResult<TRow, TMapped>(fromProvider ?? DETACHED)
  return fromProvider ? result : null
}

/** A connection that never starts: what useGristOptional reads outside a provider. */
const DETACHED: GristContextValue = (() => {
  const state = initialRuntimeState()
  const runtime: GristRuntime = {
    options: {},
    getState: () => state,
    subscribe: () => () => {},
    start: () => () => {},
    reload: async () => {},
    update: () => {},
  }
  return { runtime, api: createGristApi(runtime) }
})()

/** @internal The nearest provider's connection and its state (idle outside one). */
export function useNearestGristState(): {
  connection: GristContextValue | null
  state: GristRuntimeState
  cellIssues: readonly GristCellIssue[]
} {
  const connection = useContext(GristContext)
  const state = useGristState(connection ?? DETACHED)
  const { issues } = useMapped(state, (connection ?? DETACHED).runtime.options)
  return { connection, state, cellIssues: issues }
}
