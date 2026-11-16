/**
 * The widget's `reportUrl` (ADR 0019): its declaration says
 * `reportUrl: reportUrl()`, and the SDK links it under a failed write and on
 * the screen shown when the widget stops working. The slug and the version
 * are the build's (widgetViteConfig defines them).
 */
import { reportUrlFor } from "./report.mjs"

declare const __WIDGET_SLUG__: string
declare const __WIDGET_VERSION__: string

export const reportUrl = (): string => reportUrlFor(__WIDGET_SLUG__, __WIDGET_VERSION__)
