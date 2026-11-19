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
import type { GristColumnsToMap, GristWidgetColumnMap, GristWidgetInteraction } from "../types"

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

  isBound(): boolean {
    return this.bound
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

/**
 * Grist sends a reference as the value its column shows (`expandRefs`, its
 * default): a name, or a number that looks like a row id and isn't one. A
 * widget that declares a column as a reference (`Ref:<table>`, `RefList:…`,
 * with no `Text` alternative) asks for references, so the records come with
 * row ids (`expandRefs: false`), `w.record` included. Any other widget gets
 * what its columns show, as before. The page's first provider decides: the
 * streams are bound once.
 */
let referenceIds = false

/** @internal Whether a declaration asks for row ids: a column that accepts a reference and not text. */
export function declaresReferences(columns: GristColumnsToMap | undefined): boolean {
  return (columns ?? []).some((c) => {
    if (typeof c === "string" || !c.type) return false
    const bases = c.type.split(",").map((t) => t.trim().split(":")[0])
    return bases.some((b) => b === "Ref" || b === "RefList") && !bases.includes("Text")
  })
}

/**
 * @internal A declaration that mixes a reference column with a `Text,Ref`
 * one: the ids apply to the whole read, so the `Text,Ref` column reads the
 * id, not the name.
 */
export function mixesReferenceKinds(columns: GristColumnsToMap | undefined): boolean {
  const textRef = (columns ?? []).some((c) => {
    if (typeof c === "string" || !c.type) return false
    const bases = c.type.split(",").map((t) => t.trim().split(":")[0])
    return bases.some((b) => b === "Ref" || b === "RefList") && bases.includes("Text")
  })
  return textRef && declaresReferences(columns)
}

/** @internal The read options every section read uses, so fetchRows() agrees with w.records. */
export function sectionReadOptions(): { expandRefs?: false } {
  return referenceIds ? { expandRefs: false } : {}
}

/** @internal Tests: back to Grist's default. */
export function resetReferenceIds(): void {
  referenceIds = false
}

/** @internal Before the streams bind: records with row ids for references. */
export function setReferenceIds(on: boolean): void {
  if (!recordStream.isBound() && !recordsStream.isBound()) referenceIds = on
}

const readOptions = () => (referenceIds ? { keepEncoded: false, expandRefs: false } : { keepEncoded: false })

export const recordStream = new HostStream<RecordPayload>((emit) => {
  grist.onRecord((record, mappings) => emit({ record, mappings: asMappings(mappings) }), readOptions())

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
      const record = await fetchSelectedRecord(host.rowId, readOptions())
      emit({ record, mappings: recordStream.peek()?.mappings ?? null })
    } catch (err) {
      console.error("[grist-widget-sdk] fetchSelectedRecord on a cursor move failed:", err)
    }
  })
})

export const recordsStream = new HostStream<RecordsPayload>((emit) => {
  grist.onRecords((records, mappings) => emit({ records, mappings: asMappings(mappings) }), { ...readOptions(), format: "rows" })
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
