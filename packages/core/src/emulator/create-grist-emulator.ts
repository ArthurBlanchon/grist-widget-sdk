/**
 * Top-level emulator factory. Produces a fully-wired emulator instance:
 *
 *   - typed in-memory document state,
 *   - shared event bus,
 *   - the six host API impls,
 *   - the inline transport, which installs `grist` on the page,
 *   - imperative helpers (`mutate`, `apply`, `selectRow`, `selectTable`)
 *     that drive the document via the action engine and emit corresponding
 *     events.
 *
 * The instance is multi-instance friendly: nothing is stored on `window`.
 */

import { createApiBundle } from "./api"
import type { EmulatorApiBundle } from "./api"
import { applyUserActions } from "./core/action-engine"
import { createDocument } from "./core/document"
import { createEventBus } from "./core/event-bus"
import type { EventBus } from "./core/event-bus"
import { resolveMappings } from "./core/mappings"
import type { EmulatorDocumentState } from "./core/types"
import type { GristReplicaDocument } from "../sdk/replica-document"
import type { GristWidgetColumnMap } from "../sdk/types"
import { buildGristThemeHostMessage } from "./theme-message"
import { createInlineTransport } from "./transports"
import type { EmulatorTransport, InlineGristGlobal } from "./transports"
import { parseDocument } from "./validators"

export type CreateGristEmulatorOptions = {
  /** The starting document (must satisfy {@link parseDocument}). */
  document: GristReplicaDocument
  /** Installs `grist` on `target` (default: the global object). */
  transport?: { kind: "inline"; target?: Window & typeof globalThis }
  /** Initial widget options exposed via `WidgetAPI`. */
  widgetOptions?: Record<string, unknown>
  /**
   * Initial widget interaction info (`access_level` and friends) sent
   * alongside `onOptions`. Without an `access_level`, Grist grants the access
   * the widget requests in `grist.ready()`.
   */
  widgetInteraction?: Record<string, unknown>
  /** Initial document theme replayed on widget ready (host `message` channel). */
  initialTheme?: "light" | "dark"
}

export type GristEmulator = {
  /** Underlying mutable document. Treat as read-only outside of `mutate(...)`. */
  state: EmulatorDocumentState
  bus: EventBus
  api: EmulatorApiBundle
  transport: EmulatorTransport
  /** Synthesised `grist` global (only for the inline transport). */
  grist?: InlineGristGlobal

  /** Apply a list of Grist user actions; emits the matching events. */
  apply: (actions: unknown[][]) => { retValues: unknown[] }
  /** Convenience helpers for tests and demos. */
  mutate: {
    addRow: (tableId: string, fields: Record<string, unknown>) => number
    updateRow: (tableId: string, rowId: number, fields: Record<string, unknown>) => void
    removeRow: (tableId: string, rowId: number) => void
  }
  selectRow: (rowId: number | "new" | null) => void
  selectTable: (tableId: string) => void
  /**
   * Set logical→real column mappings, as a user mapping columns in Grist would.
   * Pass `undefined` to clear — `mappings()` becomes `null` until set again.
   */
  setColumnMappings: (mappings: GristWidgetColumnMap | undefined) => void
  setOptions: (options: Record<string, unknown>) => Promise<void>
  setInteraction: (interaction: Record<string, unknown>) => void
  /** Host theme controls (`grist.on("message")` / `msg.theme`). */
  theme: {
    set: (theme: "light" | "dark") => void
  }
  /** Tear down the emulator. Idempotent. */
  dispose: () => void
}

export function createGristEmulator(options: CreateGristEmulatorOptions): GristEmulator {
  const validatedDocument = parseDocument(options.document)
  const state = createDocument({
    ...validatedDocument,
    widgetOptions: options.widgetOptions ?? validatedDocument.widgetOptions,
    // No access_level by default: the emulator then grants the access the
    // widget asks for in grist.ready(), as a user accepting it in Grist would.
    widgetInteraction: options.widgetInteraction ?? validatedDocument.widgetInteraction ?? {},
  })
  const bus = createEventBus()
  const api = createApiBundle(state, bus)

  const inline = createInlineTransport({
    state,
    bus,
    api,
    initialTheme: options.initialTheme,
    target: options.transport?.target,
  })
  const transport: EmulatorTransport = inline
  const grist: InlineGristGlobal | undefined = inline.grist

  function apply(actions: unknown[][]) {
    return applyUserActions(state, bus, actions)
  }

  return {
    state,
    bus,
    api,
    transport,
    grist,
    apply,
    mutate: {
      addRow: (tableId, fields) => apply([["AddRecord", tableId, null, fields]]).retValues[0] as number,
      updateRow: (tableId, rowId, fields) => {
        apply([["UpdateRecord", tableId, rowId, fields]])
      },
      removeRow: (tableId, rowId) => {
        apply([["RemoveRecord", tableId, rowId]])
      },
    },
    selectRow(rowId) {
      state.selection.rowId = rowId
      bus.emit({ type: "cursor-change", tableId: state.selection.tableId, rowId })
    },
    selectTable(tableId) {
      if (!state.tables.has(tableId)) throw new Error(`Unknown table: ${tableId}`)
      state.selection.tableId = tableId
      const first = state.tables.get(tableId)!.rows[0]?.id ?? null
      state.selection.rowId = first
      bus.emit({ type: "data-change", tableId })
      bus.emit({ type: "cursor-change", tableId, rowId: first })
    },
    setColumnMappings(mappings) {
      if (mappings === undefined) {
        delete state.selection.mappings
      } else {
        state.selection.mappings = mappings
      }
      bus.emit({ type: "mappings-change", mappings: resolveMappings(state) })
    },
    async setOptions(opts) {
      await api.WidgetAPI.setOptions(opts)
    },
    setInteraction(interaction) {
      state.widgetInteraction = { ...interaction }
      bus.emit({ type: "options-change", options: { ...state.widgetOptions }, interaction: { ...interaction } })
    },
    theme: {
      set(next) {
        bus.emit({ type: "theme-change", message: buildGristThemeHostMessage(next) })
      },
    },
    dispose() {
      transport.dispose()
      bus.clear()
    },
  }
}
