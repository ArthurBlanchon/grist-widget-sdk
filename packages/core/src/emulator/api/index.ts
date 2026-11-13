/**
 * Bundles the six host-side Grist API implementations into one record so
 * inline transport can wire them up.
 */

import type { EventBus } from "../core/event-bus"
import type { EmulatorDocumentState } from "../core/types"
import { createCommandApiImpl } from "./command-api"
import { createCustomSectionApiImpl } from "./custom-section-api"
import { createGristApiImpl } from "./grist-api"
import { createGristDocApiImpl } from "./grist-doc-api"
import { createGristViewImpl } from "./grist-view"
import type {
  CommandApiImpl,
  CustomSectionApiImpl,
  GristApiImpl,
  GristDocApiImpl,
  GristViewImpl,
  WidgetApiImpl,
} from "./types"
import { createWidgetApiImpl } from "./widget-api"

export type EmulatorApiBundle = {
  GristView: GristViewImpl
  GristDocAPI: GristDocApiImpl
  WidgetAPI: WidgetApiImpl
  CustomSectionAPI: CustomSectionApiImpl
  GristAPI: GristApiImpl
  CommandAPI: CommandApiImpl
}

/**
 * Build the implementations bound to a given document state and event bus.
 * Cheap to call — every method delegates to the (mutable) `state`.
 */
export function createApiBundle(state: EmulatorDocumentState, bus: EventBus): EmulatorApiBundle {
  return {
    GristView: createGristViewImpl(state, bus),
    GristDocAPI: createGristDocApiImpl(state, bus),
    WidgetAPI: createWidgetApiImpl(state, bus),
    CustomSectionAPI: createCustomSectionApiImpl(state, bus),
    GristAPI: createGristApiImpl(),
    CommandAPI: createCommandApiImpl(bus),
  }
}

export type {
  CommandApiImpl,
  CustomSectionApiImpl,
  GristApiImpl,
  GristDocApiImpl,
  GristViewImpl,
  WidgetApiImpl,
} from "./types"
