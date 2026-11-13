/**
 * Inline transport — synthesises a `window.grist` global wired directly to
 * the emulator state. No iframe, no postMessage, no serialization.
 *
 * Used for:
 *   - SDK unit tests in jsdom (`renderWithGrist(...)`),
 *   - IDE-style live previews where widget code lives in the same window
 *     as the emulator host.
 *
 * The synthesised `grist` object exposes the **same** typed surface as the
 * production `grist-plugin-api.js` (see `hooks/grist-global.d.ts`). Hooks
 * call `grist.docApi.fetchTable(...)` etc. and get the answer directly from
 * the action engine.
 */

import type {
  GristCursorPos,
  GristFetchSelectedOptions,
  GristMinimalRecord,
  GristReadyOptions,
  GristTableOpOptions,
  GristTableOperations,
  GristTableUpdateRecord,
  GristTableUpsertOptions,
  GristTableUpsertRecord,
  GristWidgetColumnMap,
  GristWidgetInteraction,
} from "../../sdk/types"
import {
  gristAddRecordAction,
  gristBulkAddRecordAction,
  gristBulkRemoveRecordAction,
  gristBulkUpdateRecordAction,
  gristRemoveRecordAction,
  gristUpdateRecordAction,
} from "../../sdk/helpers/grist-user-actions"
import { applyUserActions } from "../core/action-engine"
import type { EmulatorEvent } from "../core/event-bus"
import { findRow, getTable } from "../core/document"
import { resolveMappings } from "../core/mappings"
import { buildGristThemeHostMessage } from "../theme-message"
import type { EmulatorTransport, TransportContext } from "./types"

/**
 * Shape of the synthesised global. Matches `globalThis.grist` from
 * `grist-global.d.ts`.
 */
export type InlineGristGlobal = {
  ready: (options?: GristReadyOptions) => Promise<void>
  onRecord: (
    cb: (record: Record<string, unknown> | null, mappings?: GristWidgetColumnMap | null) => void,
    options?: GristFetchSelectedOptions
  ) => void
  onRecords: (
    cb: (records: Record<string, unknown>[], mappings?: GristWidgetColumnMap | null) => void,
    options?: GristFetchSelectedOptions
  ) => void
  onOptions: (cb: (options: Record<string, unknown> | null, interaction: GristWidgetInteraction) => void) => void
  onNewRecord: (cb: (mappings: GristWidgetColumnMap | null) => void) => void
  mapColumnNames: (data: Record<string, unknown>) => Record<string, unknown> | null
  mapColumnNamesBack: (data: Record<string, unknown>) => Record<string, unknown>
  getOptions: () => Promise<Record<string, unknown> | null>
  getOption: (key: string) => Promise<unknown>
  setOption: (key: string, value: unknown) => Promise<void>
  setOptions: (options: Record<string, unknown>) => Promise<void>
  clearOptions: () => Promise<void>
  setCursorPos: (pos: GristCursorPos) => Promise<void>
  setSelectedRows: (rowIds: number[] | null) => Promise<void>
  fetchSelectedTable: (options?: GristFetchSelectedOptions) => Promise<Record<string, unknown[]>>
  fetchSelectedRecord: (rowId: number, options?: GristFetchSelectedOptions) => Promise<Record<string, unknown>>
  docApi: {
    getDocName: () => Promise<string>
    listTables: () => Promise<string[]>
    fetchTable: (tableId: string) => Promise<Record<string, unknown[]>>
    applyUserActions: (actions: unknown[][], options?: { desc?: string }) => Promise<{ retValues: unknown[] }>
    getAccessToken?: (options?: { readOnly?: boolean }) => Promise<{ token: string; baseUrl: string }>
    fetchSelectedTable: (options?: GristFetchSelectedOptions) => Promise<Record<string, unknown[]>>
    fetchSelectedRecord: (rowId: number, options?: GristFetchSelectedOptions) => Promise<Record<string, unknown>>
  }
  selectedTable: GristTableOperations
  getTable: (tableId?: string) => GristTableOperations
  sectionApi: {
    configure: (settings: GristReadyOptions) => Promise<void>
    mappings: () => Promise<GristWidgetColumnMap | null>
  }
  on: (eventName: string, listener: (...args: unknown[]) => void) => () => void
}

export type InlineTransportOptions = TransportContext & {
  /**
   * Where to mount the synthesised `grist` global.
   * Defaults to the current window. Pass a different target (e.g. an iframe's
   * `contentWindow`) to install it in another realm.
   */
  target?: Window & typeof globalThis
}

/**
 * Returns an {@link EmulatorTransport} **and** the synthesised `grist`
 * object. `target.grist = global` is set as a side-effect for parity with
 * the production runtime.
 */
export function createInlineTransport(
  options: InlineTransportOptions
): EmulatorTransport & { grist: InlineGristGlobal } {
  const { state, bus, api } = options
  const target = options.target ?? (globalThis as unknown as Window & typeof globalThis)

  // The SDK's `useGristAvailability` checks `window.self !== window.top`.
  // The inline transport runs in a top-level window where that's false. We
  // shim `top` so widget code thinks it's embedded — production doesn't use
  // this transport so there's no risk of leaking the shim.
  installFakeIframeContext(target)

  type RecordCb = (record: Record<string, unknown> | null, mappings?: GristWidgetColumnMap | null) => void
  type RecordsCb = (records: Record<string, unknown>[], mappings?: GristWidgetColumnMap | null) => void
  type OptionsCb = (options: Record<string, unknown> | null, interaction: GristWidgetInteraction) => void
  type NewRecordCb = (mappings: GristWidgetColumnMap | null) => void

  const recordCbs = new Map<RecordCb, GristFetchSelectedOptions | undefined>()
  const recordsCbs = new Map<RecordsCb, GristFetchSelectedOptions | undefined>()
  const optionsCbs = new Set<OptionsCb>()
  const newRecordCbs = new Set<NewRecordCb>()
  const generic = new Map<string, Set<(...args: unknown[]) => void>>()

  // Replay caches — production `grist-plugin-api.js` immediately delivers the
  // latest record / records / options to a freshly-subscribed listener, so
  // hooks that subscribe **after** `grist.ready()` still get the initial
  // payload. We mirror that behaviour here.
  type LastRecord = { record: Record<string, unknown> | null; mappings: GristWidgetColumnMap | null }
  type LastRecords = { records: Record<string, unknown>[]; mappings: GristWidgetColumnMap | null }
  type LastOptions = { options: Record<string, unknown> | null; interaction: GristWidgetInteraction }
  let lastRecord: LastRecord | null = null
  let lastRecords: LastRecords | null = null
  let lastOptions: LastOptions | null = null
  let lastNewRecord: GristWidgetColumnMap | null | undefined = undefined

  const buildInteraction = options.buildInteraction ?? (() => ({
    access_level: state.configuration?.requiredAccess ?? "read table",
    ...state.widgetInteraction,
  }))

  async function pushRecord(rowId: number | "new" | null) {
    const mappings = resolveMappings(state)
    if (rowId === "new") {
      // Grist's onRecord ignores the add-row (rowId "new"): only onNewRecord fires.
      lastNewRecord = mappings
      for (const cb of newRecordCbs) {
        try { cb(mappings) } catch (err) { logErr(err) }
      }
      return
    }
    if (rowId === null) {
      lastRecord = { record: null, mappings }
      for (const [cb] of recordCbs) {
        try { cb(null, mappings) } catch (err) { logErr(err) }
      }
      return
    }
    let record: Record<string, unknown> | null = null
    try {
      record = await api.GristView.fetchSelectedRecord(rowId)
    } catch (err) {
      logErr(err)
    }
    lastRecord = { record, mappings }
    for (const [cb, opts] of recordCbs) {
      try {
        const r = opts?.keepEncoded
          ? await api.GristView.fetchSelectedRecord(rowId, { keepEncoded: true })
          : record
        cb(r, mappings)
      } catch (err) {
        logErr(err)
      }
    }
  }

  async function pushRecords() {
    const mappings = resolveMappings(state)
    let baseRows: Record<string, unknown>[] = []
    try {
      const columnar = await api.GristView.fetchSelectedTable({})
      baseRows = columnsToRows(columnar)
    } catch (err) {
      logErr(err)
    }
    lastRecords = { records: baseRows, mappings }
    for (const [cb, opts] of recordsCbs) {
      try {
        const fetchOptions = coerceFetchOptions(opts)
        // Re-fetch only when the subscriber asked for a different shape
        // (e.g. `keepEncoded: true`). Otherwise reuse the decoded rows we
        // already have to avoid extra work and to match production where
        // the same fetch is broadcast to every listener.
        const rows = fetchOptions?.keepEncoded
          ? columnsToRows(await api.GristView.fetchSelectedTable({ keepEncoded: true }))
          : baseRows
        cb(rows, mappings)
      } catch (err) {
        logErr(err)
      }
    }
  }

  /**
   * Mirror what `viewApi.fetchSelectedTable` does inside `grist-plugin-api.js`:
   * the host RPC stub always returns columnar; the wrapper applies the
   * `format: "rows"` transpose (and would decode encoded values when
   * `keepEncoded: false` — a no-op here because our `rowsToColumnar` already
   * emits JS-native primitives in that case).
   *
   * Keeping this logic on the inline side guarantees that widgets see the
   * same result whether they go through the iframe transport (real plugin
   * wrapper) or the inline transport (this wrapper).
   */
  async function fetchSelectedTableShaped(
    opts: GristFetchSelectedOptions | undefined
  ): Promise<Record<string, unknown[]> | Record<string, unknown>[]> {
    const fetchOptions = coerceFetchOptions(opts)
    const columnar = (await api.GristView.fetchSelectedTable(
      fetchOptions ? { keepEncoded: fetchOptions.keepEncoded } : {}
    )) as Record<string, unknown[]>
    if (fetchOptions?.format === "rows") return columnsToRows(columnar)
    return columnar
  }

  function pushOptions() {
    const opts = Object.keys(state.widgetOptions).length > 0 ? { ...state.widgetOptions } : null
    const interaction = buildInteraction()
    lastOptions = { options: opts, interaction }
    for (const cb of optionsCbs) {
      try { cb(opts, interaction) } catch (err) { logErr(err) }
    }
  }

  const offBus = bus.on(async (event: EmulatorEvent) => {
    switch (event.type) {
      case "data-change":
        await pushRecords()
        await pushRecord(state.selection.rowId)
        break
      case "cursor-change":
        await pushRecord(event.rowId)
        break
      case "options-change":
        pushOptions()
        break
      case "ready":
        pushOptions()
        if (options.initialTheme) {
          notify("message", buildGristThemeHostMessage(options.initialTheme, { fromReady: true }))
        }
        await pushRecords()
        await pushRecord(state.selection.rowId)
        break
      case "mappings-change":
        await pushRecords()
        await pushRecord(state.selection.rowId)
        break
      case "theme-change":
        notify("message", event.message)
        break
    }
  })

  function makeTableOps(tableId: string): GristTableOperations {
    return {
      async getTableId() { return tableId },
      async create(records, options) {
        const list = Array.isArray(records) ? records : [records]
        const ids: GristMinimalRecord[] = []
        for (const r of list) {
          const result = applyUserActions(state, bus, [
            gristAddRecordAction(tableId, parseFields(r.fields, options)),
          ])
          ids.push({ id: result.retValues[0] as number })
        }
        return Array.isArray(records) ? ids : ids[0]
      },
      async update(records: GristTableUpdateRecord | GristTableUpdateRecord[], options?: GristTableOpOptions) {
        const list = Array.isArray(records) ? records : [records]
        const actions = list.map((r) => gristUpdateRecordAction(tableId, r.id, parseFields(r.fields, options)))
        applyUserActions(state, bus, actions)
      },
      async upsert(records: GristTableUpsertRecord | GristTableUpsertRecord[], options?: GristTableUpsertOptions) {
        const list = Array.isArray(records) ? records : [records]
        const allowAdd = options?.add !== false
        const allowUpdate = options?.update !== false
        const table = getTable(state, tableId)
        const actions: unknown[][] = []
        for (const r of list) {
          const matches = table.rows.filter((row) =>
            Object.entries(r.require).every(([k, v]) => row[k] === v)
          )
          if (matches.length > 0) {
            if (!allowUpdate) continue
            const fields = parseFields(r.fields ?? {}, options)
            for (const m of matches) actions.push(gristUpdateRecordAction(tableId, m.id, fields))
          } else if (allowAdd) {
            actions.push(gristAddRecordAction(tableId, { ...r.require, ...parseFields(r.fields ?? {}, options) }))
          }
        }
        if (actions.length > 0) applyUserActions(state, bus, actions)
      },
      async destroy(recordIds: number | number[]) {
        if (Array.isArray(recordIds)) {
          applyUserActions(state, bus, [gristBulkRemoveRecordAction(tableId, recordIds)])
        } else {
          applyUserActions(state, bus, [gristRemoveRecordAction(tableId, recordIds)])
        }
        // touch the unused bulk-add reference for tree-shaking parity, no-op
        void gristBulkAddRecordAction
        void gristBulkUpdateRecordAction
      },
    }
  }

  function notify(event: string, ...args: unknown[]) {
    const set = generic.get(event)
    if (!set) return
    for (const fn of set) {
      try { fn(...args) } catch (err) { logErr(err) }
    }
  }

  const grist: InlineGristGlobal = {
    async ready(opts) {
      await api.CustomSectionAPI.configure(opts ? { ...opts, onEditOptions: undefined } as unknown as Record<string, unknown> : {})
    },

    onRecord(cb, opts) {
      recordCbs.set(cb, opts)
      // Replay last value so late subscribers don't miss the initial event.
      if (lastRecord) {
        try { cb(lastRecord.record, lastRecord.mappings) } catch (err) { logErr(err) }
      }
    },
    onRecords(cb, opts) {
      recordsCbs.set(cb, opts)
      if (lastRecords) {
        try { cb(lastRecords.records, lastRecords.mappings) } catch (err) { logErr(err) }
      }
    },
    onOptions(cb) {
      optionsCbs.add(cb)
      if (lastOptions) {
        try { cb(lastOptions.options, lastOptions.interaction) } catch (err) { logErr(err) }
      }
    },
    onNewRecord(cb) {
      newRecordCbs.add(cb)
      if (lastNewRecord !== undefined) {
        try { cb(lastNewRecord) } catch (err) { logErr(err) }
      }
    },

    mapColumnNames(data) {
      const mappings = resolveMappings(state)
      if (!mappings) return null
      const out: Record<string, unknown> = {}
      let allMapped = true
      for (const [logical, real] of Object.entries(mappings)) {
        if (Array.isArray(real)) {
          out[logical] = real.map((r) => data[r])
        } else if (typeof real === "string") {
          out[logical] = data[real]
        } else {
          allMapped = false
        }
      }
      return allMapped ? out : null
    },
    mapColumnNamesBack(data) {
      const mappings = resolveMappings(state)
      if (!mappings) return data
      const out: Record<string, unknown> = {}
      for (const [logical, real] of Object.entries(mappings)) {
        if (typeof real === "string" && logical in data) {
          out[real] = data[logical]
        }
      }
      return out
    },

    getOption: (k) => api.WidgetAPI.getOption(k),
    setOption: (k, v) => api.WidgetAPI.setOption(k, v),
    getOptions: () => api.WidgetAPI.getOptions(),
    setOptions: (o) => api.WidgetAPI.setOptions(o),
    clearOptions: () => api.WidgetAPI.clearOptions(),

    setCursorPos: (pos) => api.GristView.setCursorPos(pos),
    setSelectedRows: (rowIds) => api.GristView.setSelectedRows(rowIds),
    fetchSelectedTable: (opts) =>
      fetchSelectedTableShaped(opts) as Promise<Record<string, unknown[]>>,
    fetchSelectedRecord: (rowId, opts) => api.GristView.fetchSelectedRecord(rowId, coerceFetchOptions(opts)),

    docApi: {
      getDocName: () => api.GristDocAPI.getDocName(),
      listTables: () => api.GristDocAPI.listTables(),
      fetchTable: (id) => api.GristDocAPI.fetchTable(id),
      applyUserActions: (actions, options) => api.GristDocAPI.applyUserActions(actions, options),
      getAccessToken: (opts) => api.GristDocAPI.getAccessToken(opts),
      fetchSelectedTable: (opts) =>
        fetchSelectedTableShaped(opts) as Promise<Record<string, unknown[]>>,
      fetchSelectedRecord: (rowId, opts) =>
        api.GristView.fetchSelectedRecord(rowId, coerceFetchOptions(opts)),
    },

    get selectedTable() {
      return makeTableOps(state.selection.tableId)
    },

    getTable(tableId) {
      return makeTableOps(tableId ?? state.selection.tableId)
    },

    sectionApi: {
      configure: (settings) => api.CustomSectionAPI.configure(settings as unknown as Record<string, unknown>),
      mappings: () => api.CustomSectionAPI.mappings(),
    },

    on(eventName, listener) {
      let set = generic.get(eventName)
      if (!set) generic.set(eventName, (set = new Set()))
      set.add(listener)
      return () => set!.delete(listener)
    },
  }

  ;(target as unknown as { grist: InlineGristGlobal }).grist = grist

  return {
    grist,
    dispose() {
      offBus()
      // Restore the global (only if we still own it).
      const t = target as unknown as { grist?: unknown }
      if (t.grist === grist) delete t.grist
      recordCbs.clear()
      recordsCbs.clear()
      optionsCbs.clear()
      newRecordCbs.clear()
      generic.clear()
      lastRecord = null
      lastRecords = null
      lastOptions = null
      lastNewRecord = undefined
    },
    fireDataChange(tableId) {
      bus.emit({ type: "data-change", tableId: tableId ?? state.selection.tableId })
    },
    fireCursor(rowId) {
      const id = rowId === undefined ? state.selection.rowId : rowId
      bus.emit({ type: "cursor-change", tableId: state.selection.tableId, rowId: id })
    },
    fireOptions() {
      pushOptions()
    },
    fireTheme(message) {
      bus.emit({ type: "theme-change", message })
    },
    emitInitialState() {
      pushOptions()
      void pushRecords().then(() => pushRecord(state.selection.rowId))
    },
  }
}

function columnsToRows(columnar: Record<string, unknown[]>): Record<string, unknown>[] {
  const cols = Object.keys(columnar)
  if (cols.length === 0) return []
  const length = (columnar[cols[0]] ?? []).length
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < length; i++) {
    const row: Record<string, unknown> = {}
    for (const c of cols) row[c] = columnar[c][i]
    rows.push(row)
  }
  return rows
}

function parseFields(fields: Record<string, unknown>, _options?: GristTableOpOptions): Record<string, unknown> {
  // The emulator currently doesn't implement string-parsing; pass-through.
  // Hook into here to add date/number parsing when we surface that toggle.
  return { ...fields }
}

function coerceFetchOptions(
  opts: GristFetchSelectedOptions | undefined
): { keepEncoded?: boolean; format?: "rows" | "columns" } | undefined {
  if (!opts) return undefined
  const format = opts.format === "rows" || opts.format === "columns" ? opts.format : undefined
  return { keepEncoded: opts.keepEncoded, format }
}

function logErr(err: unknown) {
  console.error("[grist-emulator/inline]", err)
}

// Touch helpers to keep them tree-shake-friendly even if unused in current scope.
void findRow

/**
 * Make `window.self !== window.top` evaluate to `true`. The SDK uses this
 * exact comparison in `useGristAvailability` to detect an iframe environment.
 *
 * Inline transports run inside the host window (tests, IDE preview) and would
 * otherwise be flagged as "not embedded" — this shim is the same trick we use
 * in the testing harness and is safe because the inline transport is never
 * shipped to production.
 */
function installFakeIframeContext(target: Window & typeof globalThis) {
  try {
    if (target.self !== target.top) return
    Object.defineProperty(target, "top", {
      configurable: true,
      get: () => ({}),
    })
  } catch {
    // Some environments lock these globals; ignore silently.
  }
}
