/**
 * Grist's event streams, bound once per page.
 *
 * `grist.onRecord`, `onRecords`, `onOptions`, `onNewRecord` and `on("message")`
 * are add-only: there is no `off`. Binding them in every provider (React's
 * StrictMode mounts twice; a widget may remount) would stack handlers for the
 * page's lifetime. Each stream here binds at its first subscriber and fans out
 * to the current ones; a late subscriber gets the last value at once.
 *
 * Records are bound with the plugin API's decoded rows (`keepEncoded: false`,
 * rows for `onRecords`), the shape widget code reads.
 */

import { normalizeWidgetInteraction } from "../helpers/grist-widget-interaction"
import type { GristWidgetColumnMap, GristWidgetInteraction } from "../types"

type Listener<T> = (value: T) => void

export class HostStream<T> {
  private listeners = new Set<Listener<T>>()
  private bound = false
  private has = false
  private last: T | undefined

  constructor(private readonly bind: (emit: (value: T) => void) => void) {}

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener)
    if (!this.bound) {
      this.bound = true
      try {
        this.bind((value) => this.emit(value))
      } catch (err) {
        console.error("[grist-widget-sdk] could not subscribe to a Grist event:", err)
      }
    }
    if (this.has) listener(this.last as T)
    return () => {
      this.listeners.delete(listener)
    }
  }

  peek(): T | undefined {
    return this.last
  }

  /** Tests: deliver a value as if Grist had sent it. */
  emit(value: T): void {
    this.has = true
    this.last = value
    for (const l of [...this.listeners]) l(value)
  }

  /** Tests: forget the binding, so a new `window.grist` binds afresh. */
  reset(): void {
    this.listeners.clear()
    this.bound = false
    this.has = false
    this.last = undefined
  }
}

export type RecordPayload = { record: Record<string, unknown> | null; mappings: GristWidgetColumnMap | null }
export type RecordsPayload = { records: Record<string, unknown>[]; mappings: GristWidgetColumnMap | null }
export type OptionsPayload = { options: Record<string, unknown> | null; interaction: GristWidgetInteraction | null }
export type NewRecordPayload = { mappings: GristWidgetColumnMap | null }

const asMappings = (m: unknown) => (m && typeof m === "object" ? (m as GristWidgetColumnMap) : null)

export const recordStream = new HostStream<RecordPayload>((emit) => {
  grist.onRecord((record, mappings) => emit({ record, mappings: asMappings(mappings) }), { keepEncoded: false })

  // Grist's RecordNotifier posts `{ tableId, rowId }` on a cursor move. The
  // plugin API's onRecord handles it, but refetching here when the row
  // changes keeps a widget from sticking on its first row if that path is
  // skipped (seen in production iframes).
  const fetchSelectedRecord = grist.fetchSelectedRecord ?? grist.docApi?.fetchSelectedRecord
  if (typeof grist.on !== "function" || typeof fetchSelectedRecord !== "function") return
  let lastRowId: number | undefined
  grist.on("message", async (msg: unknown) => {
    const host = msg as { tableId?: string; rowId?: unknown } | null
    if (!host?.tableId || typeof host.rowId !== "number" || host.rowId === lastRowId) return
    lastRowId = host.rowId
    try {
      const record = await fetchSelectedRecord(host.rowId, { keepEncoded: false })
      emit({ record, mappings: recordStream.peek()?.mappings ?? null })
    } catch (err) {
      console.error("[grist-widget-sdk] fetchSelectedRecord on a cursor move failed:", err)
    }
  })
})

export const recordsStream = new HostStream<RecordsPayload>((emit) => {
  grist.onRecords((records, mappings) => emit({ records, mappings: asMappings(mappings) }), {
    keepEncoded: false,
    format: "rows",
  })
})

export const optionsStream = new HostStream<OptionsPayload>((emit) => {
  grist.onOptions((options, interaction) =>
    emit({
      options: options ? { ...options } : null,
      interaction: normalizeWidgetInteraction((interaction as GristWidgetInteraction | null) ?? null),
    })
  )
})

export const newRecordStream = new HostStream<NewRecordPayload>((emit) => {
  if (typeof grist.onNewRecord !== "function") return
  grist.onNewRecord((mappings) => emit({ mappings: asMappings(mappings) }))
})

/** Grist's host messages (`grist.on("message")`): the theme travels here. */
export const messageStream = new HostStream<unknown>((emit) => {
  if (typeof grist.on !== "function") return
  grist.on("message", (msg: unknown) => emit(msg))
})

export const ALL_STREAMS = [recordStream, recordsStream, optionsStream, newRecordStream, messageStream] as const
