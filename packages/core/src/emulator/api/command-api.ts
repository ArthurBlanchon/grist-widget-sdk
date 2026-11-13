import type { EventBus } from "../core/event-bus"
import type { CommandApiImpl } from "./types"

/**
 * `CommandAPI` host implementation. The widget's "Edit Options" gear and a
 * few keyboard shortcuts call into this. We forward the call name on the bus
 * so the inspector and tests can observe it; useful to assert
 * `onEditOptions` flows.
 */
export function createCommandApiImpl(bus: EventBus): CommandApiImpl {
  return {
    async run(name) {
      bus.emit({ type: "user-action", action: ["RunCommand", name] })
    },
  }
}
