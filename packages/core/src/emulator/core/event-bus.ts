/**
 * Tiny pub-sub used to broadcast every emulator state change to:
 *   - the transports (which translate events into protocol messages),
 *   - the React DevTools inspector (timeline view),
 *   - the testing harness (assertions on emitted events).
 */

import type { GristCursorPos, GristWidgetColumnMap, GristWidgetInteraction } from "../../sdk/types"

export type EmulatorEvent =
  | { type: "data-change"; tableId: string }
  | { type: "cursor-change"; tableId: string; rowId: number | "new" | null; cursor?: GristCursorPos }
  | { type: "options-change"; options: Record<string, unknown>; interaction: GristWidgetInteraction }
  | { type: "theme-change"; message: Record<string, unknown> }
  | { type: "ready"; configuration: unknown }
  | { type: "user-action"; action: unknown[] }
  | { type: "mappings-change"; mappings: GristWidgetColumnMap | null }

export type EmulatorEventListener = (event: EmulatorEvent) => void

export type EventBus = {
  emit: (event: EmulatorEvent) => void
  on: (listener: EmulatorEventListener) => () => void
  history: () => readonly EmulatorEvent[]
  clear: () => void
}

export type EventBusOptions = {
  /** Cap on history length (DevTools / tests). Defaults to 200. */
  historyLimit?: number
}

export function createEventBus(options: EventBusOptions = {}): EventBus {
  const limit = options.historyLimit ?? 200
  const listeners = new Set<EmulatorEventListener>()
  const history: EmulatorEvent[] = []

  return {
    emit(event) {
      history.push(event)
      if (history.length > limit) history.shift()
      for (const fn of [...listeners]) {
        try {
          fn(event)
        } catch (err) {
          console.error("[grist-emulator] event listener threw:", err)
        }
      }
    },
    on(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    history() {
      return history
    },
    clear() {
      history.length = 0
    },
  }
}
