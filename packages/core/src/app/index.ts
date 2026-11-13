/**
 * `grist-widget-sdk/app` — what a widget's `src/main.tsx` used to wire by
 * hand: mounting, inside- vs outside-Grist pages, the deploy channel and
 * version list, and the light/dark theme.
 *
 * ```tsx
 * import { mountGristWidget } from "grist-widget-sdk/app"
 * import "./index.css"
 * import * as entry from "./app/App"
 *
 * mountGristWidget(entry, { dev: import.meta.env.DEV })
 * ```
 */

export {
  GristWidgetApp,
  entryProps,
  mountGristWidget,
  type GristWidgetAppProps,
  type GristWidgetEntry,
  type MountGristWidgetConfig,
  type MountedGristWidget,
} from "./mount-grist-widget"
export { useTheme, type ResolvedWidgetTheme, type UseThemeResult, type WidgetTheme } from "./widget-theme"
export { deployChannelLabel, parseDeployPath, type DeployChannel, type DeployPath } from "./deploy-path"
export { useReleasedVersions, type ReleasedVersion, type UseReleasedVersionsResult } from "./released-versions"
