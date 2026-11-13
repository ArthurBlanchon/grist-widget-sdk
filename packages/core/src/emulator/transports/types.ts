import type { GristCursorPos, GristWidgetInteraction } from "../../sdk/types"
import type { EmulatorApiBundle } from "../api"
import type { EventBus } from "../core/event-bus"
import type { EmulatorDocumentState } from "../core/types"

export type EmulatorTransport = {
  /** Tear the transport down. Idempotent. */
  dispose: () => void
  /** Push a "data refreshed" hint to the widget. */
  fireDataChange: (tableId?: string) => void
  /** Push a cursor change to the widget (number rowId, "new", or null). */
  fireCursor: (rowId?: number | "new" | null) => void
  /** Push the current options + interaction to the widget. */
  fireOptions: () => void
  /** Push a host theme message (`grist.on("message")` / `msg.theme`). */
  fireTheme: (message: Record<string, unknown>) => void
  /** Replays the post-ready bootstrap (options + cursor + data) as if the widget had just connected. */
  emitInitialState: () => void
}

export type TransportContext = {
  state: EmulatorDocumentState
  bus: EventBus
  api: EmulatorApiBundle
  /** Initial document theme replayed on widget ready (host message channel). */
  initialTheme?: "light" | "dark"
  /**
   * Information piggybacked on `onOptions`. Same as `state.widgetInteraction`
   * by default but transports may augment it (e.g. `access_level` derived
   * from `state.configuration.requiredAccess`).
   */
  buildInteraction?: () => GristWidgetInteraction
  /**
   * Cursor sentinel sent on initial connection. Defaults to the current
   * `state.selection.rowId` (which can be `null`, `"new"`, or a numeric id).
   */
  initialCursor?: () => number | "new" | null
  /** Optional cursor sent alongside `onRecord` payloads. */
  cursor?: () => GristCursorPos | undefined
}
