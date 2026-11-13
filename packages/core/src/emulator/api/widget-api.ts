import type { EventBus } from "../core/event-bus"
import type { EmulatorDocumentState } from "../core/types"
import type { WidgetApiImpl } from "./types"

/**
 * `WidgetAPI` host implementation, backing `grist.widgetApi.*`. Reads and
 * writes the per-widget options bag persisted on the emulator state. Each
 * mutation triggers an `options-change` event so subscribers (the transport
 * pushes an `onOptions` message; tests/inspector update accordingly) stay in
 * lock-step with the document.
 */
export function createWidgetApiImpl(state: EmulatorDocumentState, bus: EventBus): WidgetApiImpl {
  function emit() {
    bus.emit({
      type: "options-change",
      options: { ...state.widgetOptions },
      interaction: { ...state.widgetInteraction },
    })
  }

  return {
    async getOption(key) {
      return state.widgetOptions[key]
    },

    async setOption(key, value) {
      state.widgetOptions[key] = value
      emit()
    },

    async getOptions() {
      return Object.keys(state.widgetOptions).length > 0 ? { ...state.widgetOptions } : null
    },

    // Replaces every option, as Grist's WidgetAPI.setOptions does.
    async setOptions(options) {
      state.widgetOptions = { ...options }
      emit()
    },

    async clearOptions() {
      state.widgetOptions = {}
      emit()
    },
  }
}
