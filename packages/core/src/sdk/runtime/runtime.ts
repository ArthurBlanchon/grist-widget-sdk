/**
 * The widget's connection to Grist: one store, one `connect()`.
 *
 * The template loads `grist-plugin-api.js` with a classic blocking script, so
 * `window.grist` is there when the widget starts, or it never will be: the
 * check is synchronous (with one more look at `load`, for a page that loads
 * the script asynchronously). Then `grist.ready()` once, and every Grist
 * stream (records, options, mappings, theme) feeds one immutable state that
 * React reads through `useSyncExternalStore`. No polling, no heartbeat: the
 * iframe lives and dies with the Grist page, and a failed call fails where it
 * was made.
 */

import { parseGristThemePayload } from "../helpers/grist-theme-payload"
import type { GristSdkAlertKind } from "../helpers/grist-sdk-alerts"
import type { StandardSchema } from "./cells"
import type {
  GristReadyOptions,
  GristRequiredAccess,
  GristRowRecord,
  GristWidgetColumnMap,
  GristWidgetInteraction,
} from "../types"
import { parseAccess } from "./derive"
import { messageStream, newRecordStream, optionsStream, recordsStream, recordStream } from "./host"
import { ensureGristReady, resetGristReady } from "./ready"

export type GristConnection = "connecting" | "ready" | "not-embedded" | "unavailable" | "error"
export type GristTheme = "light" | "dark"
export type GristWidgetActionStatus = "idle" | "running" | "error"

export type GristRuntimeState = {
  connection: GristConnection
  /** Why the connection failed (`connection === "error"`). */
  connectionError: string | null
  declaredAccess: GristRequiredAccess
  /** The access Grist reports with the widget options; null before it does. */
  grantedAccess: GristRequiredAccess | null
  record: GristRowRecord | null
  records: GristRowRecord[] | null
  isNewRecord: boolean
  /** Logical → real column ids; null until Grist reports them. */
  mappings: GristWidgetColumnMap | null
  widgetOptions: Record<string, unknown> | null
  interaction: GristWidgetInteraction | null
  currentTableId: string | null
  theme: GristTheme | null
  actionStatus: GristWidgetActionStatus
  actionError: string | null
  /** The last read that Grist refused for lack of access, for the alerts. */
  readError: string | null
  /** Logical columns the last `mapBack` couldn't write (allowMultiple), for the alerts. */
  mapBackSkipped: readonly string[]
}

/** What a widget asks Grist for (`UseGristOptions`). */
export type GristRuntimeOptions = GristReadyOptions & {
  /** Alert kinds mountGristWidget() never shows for this widget, e.g. ["section-not-linked"]. */
  suppressAlerts?: GristSdkAlertKind[]
  /**
   * Extra rules for the mapped records, as a Standard Schema (zod 4,
   * valibot, arktype…), checked after each cell's declared type. A record
   * that fails keeps its typed values; its issues go to `cellIssues`.
   */
  schema?: StandardSchema
}

export type GristRuntime = {
  readonly options: GristRuntimeOptions
  getState(): GristRuntimeState
  subscribe(listener: () => void): () => void
  /** Connects (idempotent). Returns a function that stops listening. */
  start(): () => void
  /** Re-runs `grist.ready()` and re-reads mappings and the table. */
  reload(): Promise<void>
  update(patch: Partial<GristRuntimeState>): void
}

const READY_TIMEOUT_MS = 30_000

export function initialRuntimeState(options: GristReadyOptions = {}): GristRuntimeState {
  return {
    connection: "connecting",
    connectionError: null,
    declaredAccess: options.requiredAccess ?? "read table",
    grantedAccess: null,
    record: null,
    records: null,
    isNewRecord: false,
    mappings: null,
    widgetOptions: null,
    interaction: null,
    currentTableId: null,
    theme: null,
    actionStatus: "idle",
    actionError: null,
    readError: null,
    mapBackSkipped: [],
  }
}

function isEmbedded(): boolean {
  try {
    return typeof window !== "undefined" && window.self !== window.top
  } catch {
    return true // a cross-origin parent throws: we are in an iframe
  }
}

const hasGrist = () => typeof grist !== "undefined" && grist !== null

export function createGristRuntime(options: GristRuntimeOptions = {}): GristRuntime {
  let state = initialRuntimeState(options)
  const listeners = new Set<() => void>()
  let starts = 0
  let stopStreams: (() => void) | null = null
  let attempt = 0

  const update = (patch: Partial<GristRuntimeState>) => {
    let changed = false
    for (const key of Object.keys(patch) as (keyof GristRuntimeState)[]) {
      if (!Object.is(state[key], patch[key])) changed = true
    }
    if (!changed) return
    state = { ...state, ...patch }
    for (const l of [...listeners]) l()
  }

  const payload: GristReadyOptions = {
    requiredAccess: options.requiredAccess ?? "read table",
    columns: options.columns ?? [],
    ...(options.allowSelectBy !== undefined ? { allowSelectBy: options.allowSelectBy } : {}),
    ...(options.hasCustomOptions !== undefined ? { hasCustomOptions: options.hasCustomOptions } : {}),
    ...(options.onEditOptions ? { onEditOptions: options.onEditOptions } : {}),
  }

  const refreshTable = async () => {
    try {
      const tableId = await grist.selectedTable?.getTableId()
      if (tableId) update({ currentTableId: tableId })
    } catch {
      // Not every host answers; currentTableId stays as it was.
    }
  }

  const refreshMappings = async () => {
    if (typeof grist.sectionApi?.mappings !== "function") return
    try {
      const mappings = await grist.sectionApi.mappings()
      // A stream may have reported newer mappings while this was in flight.
      if (state.mappings === null) update({ mappings: (mappings as GristWidgetColumnMap | null) ?? {} })
    } catch {
      // The streams report mappings too.
    }
  }

  const connect = async () => {
    const mine = ++attempt
    update({ connection: "connecting", connectionError: null })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        ensureGristReady(payload),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Grist did not answer grist.ready() within ${READY_TIMEOUT_MS / 1000} s.`)), READY_TIMEOUT_MS)
        }),
      ])
    } catch (err) {
      if (mine === attempt) update({ connection: "error", connectionError: err instanceof Error ? err.message : String(err) })
      return
    } finally {
      clearTimeout(timer)
    }
    if (mine !== attempt) return
    update({ connection: "ready" })
    await Promise.all([refreshMappings(), refreshTable()])
  }

  const listen = () => {
    const offs = [
      // Copies: a host may reuse one record object and mutate it in place.
      recordStream.subscribe(({ record, mappings }) =>
        update({
          record: record ? ({ ...record } as GristRowRecord) : null,
          isNewRecord: false,
          ...(mappings ? { mappings } : {}),
        })
      ),
      recordsStream.subscribe(({ records, mappings }) => {
        update({ records: records.map((r) => ({ ...r }) as GristRowRecord), ...(mappings ? { mappings } : {}) })
        void refreshTable()
      }),
      optionsStream.subscribe(({ options: widgetOptions, interaction }) =>
        update({
          widgetOptions,
          interaction,
          grantedAccess: parseAccess(interaction?.access_level) ?? state.grantedAccess,
        })
      ),
      newRecordStream.subscribe(({ mappings }) => update({ isNewRecord: true, ...(mappings ? { mappings } : {}) })),
      messageStream.subscribe((msg) => {
        const theme = parseGristThemePayload(msg)
        if (theme) update({ theme })
      }),
    ]
    return () => offs.forEach((off) => off())
  }

  const begin = () => {
    if (!isEmbedded()) return update({ connection: "not-embedded" })
    if (!hasGrist()) {
      // A page that loads the plugin API asynchronously: one more look once
      // everything has loaded, then it is unavailable.
      if (typeof document !== "undefined" && document.readyState !== "complete" && typeof window !== "undefined") {
        window.addEventListener("load", () => (hasGrist() ? begin() : update({ connection: "unavailable" })), { once: true })
        return
      }
      return update({ connection: "unavailable" })
    }
    // Bound before ready(): Grist may push the first record during it.
    stopStreams ??= listen()
    void connect()
  }

  return {
    options,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (starts++ === 0) begin()
      return () => {
        if (--starts > 0) return
        stopStreams?.()
        stopStreams = null
      }
    },
    async reload() {
      if (!hasGrist() || !isEmbedded()) return begin()
      resetGristReady()
      update({ mappings: null })
      stopStreams ??= listen()
      await connect()
    },
    update,
  }
}
