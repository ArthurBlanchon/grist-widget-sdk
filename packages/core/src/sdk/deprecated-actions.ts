/**
 * The user-action builders, as the root entry exported them before
 * `grist-widget-sdk/actions`: each warns once in development, then works.
 */

import { deprecatedFunction } from "./helpers/deprecate"
import * as actions from "./helpers/grist-user-actions"

const moved = <K extends keyof typeof actions>(name: K) =>
  deprecatedFunction(
    `${name} from "grist-widget-sdk"`,
    `import it from "grist-widget-sdk/actions"`,
    actions[name] as (...args: never[]) => unknown
  ) as (typeof actions)[K]

/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristAddColumnAction = moved("gristAddColumnAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristAddRecordAction = moved("gristAddRecordAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristAddTableAction = moved("gristAddTableAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristAddVisibleColumnAction = moved("gristAddVisibleColumnAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristModifyColumnAction = moved("gristModifyColumnAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristRemoveColumnAction = moved("gristRemoveColumnAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristRemoveRecordAction = moved("gristRemoveRecordAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristRenameColumnAction = moved("gristRenameColumnAction")
/** @deprecated Import it from `grist-widget-sdk/actions`. */
export const gristUpdateRecordAction = moved("gristUpdateRecordAction")
