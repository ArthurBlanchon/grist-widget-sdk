import { resolveMappings } from "../core/mappings"
import type { EventBus } from "../core/event-bus"
import type { GristWidgetConfiguration } from "../../sdk/types"
import type { EmulatorDocumentState } from "../core/types"
import type { CustomSectionApiImpl } from "./types"

/**
 * `CustomSectionAPI` host implementation, called by `grist-plugin-api.js`
 * after `grist.ready()` to hand the host the widget's preferences:
 * required access, declared columns, allowSelectBy, hasCustomOptions, etc.
 *
 * Implementation:
 *   - persists the configuration onto `state.configuration`,
 *   - emits a `ready` event so the transport knows it is safe to push
 *     initial cursor / data / options messages,
 *   - re-emits a `mappings-change` so the inspector and tests can react.
 */
export function createCustomSectionApiImpl(
  state: EmulatorDocumentState,
  bus: EventBus
): CustomSectionApiImpl {
  return {
    async configure(settings) {
      const config: GristWidgetConfiguration = {
        requiredAccess: settings.requiredAccess as GristWidgetConfiguration["requiredAccess"],
        columns: settings.columns as GristWidgetConfiguration["columns"],
        allowSelectBy: settings.allowSelectBy as boolean | undefined,
        hasCustomOptions: settings.hasCustomOptions as boolean | undefined,
      }
      state.configuration = config
      bus.emit({ type: "ready", configuration: config })
      bus.emit({ type: "mappings-change", mappings: resolveMappings(state) })
    },

    async mappings() {
      return resolveMappings(state)
    },
  }
}
