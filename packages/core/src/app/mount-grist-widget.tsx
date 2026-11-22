import { StrictMode, Suspense, type ComponentType, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { GristBoundary, GristWidgetProvider } from "../sdk"
import { usePageMetadata } from "../sdk/use-widget-metadata"
import type { GristWidget, GristWidgetMetadata, UseGristOptions } from "../sdk"
import { isGristWidget } from "../sdk/define-widget"
import { LocalDevPage as DefaultLocalDevPage } from "./chrome/local-dev-page"
import { ReleasePage as DefaultReleasePage } from "./chrome/release-page"
import { ReportUrlProvider, WidgetCrashBoundary } from "./chrome/report-problem"
import { GristChromeLocaleProvider } from "../sdk/chrome-messages"
import { WidgetAlerts } from "./chrome/widget-alerts"
import { WithSettingsView } from "./chrome/settings-view"
import { parseDeployPath, type DeployChannel } from "./deploy-path"
import { EmbeddedThemeProvider, StandaloneThemeProvider } from "./widget-theme"

/** What renders a widget: the component, what it asks Grist for, and the pages and alerts around it. */
export type GristWidgetAppProps = {
  /** The widget. A `React.lazy()` component works too: its code then loads only inside Grist. */
  App: ComponentType
  /** The widget's `GRIST_OPTIONS`: access level, columns, and so on. */
  options: UseGristOptions
  /**
   * The page's title and description (the widget's `WIDGET_METADATA`, or its
   * declaration's), and where to report a problem: the alerts and the screen
   * shown if the widget stops working link `reportUrl`.
   */
  metadata?: GristWidgetMetadata
  /**
   * Whether this is the local dev server. Pass `import.meta.env.DEV`.
   * Outside Grist it picks the local-dev page over the release page.
   */
  dev?: boolean
  /**
   * Wraps the widget inside Grist, under {@link GristBoundary}. The default
   * lists what needs the user's attention (column mapping, access level,
   * failed writes) above the widget; `null` renders the widget alone.
   */
  Alerts?: ComponentType<{ children: ReactNode }> | null
  /**
   * The widget's settings: only the fields, which write its options
   * (`patchWidgetOptions`). With it, Grist's "Open configuration" shows for
   * the widget (`hasCustomOptions` defaults to `true`), and while the
   * configuration is open (that button, or the widget's own calling
   * `openConfiguration()`), a Settings view fills the widget's panel: a
   * header, a "Back to widget" button, the reminder to click Grist's Save
   * while the new options are a draft, then these fields, scrolling.
   */
  Settings?: ComponentType
  /** Shown outside Grist on the local dev server. Defaults to a page pointing at `pnpm test` and the `dev` loop. */
  LocalDevPage?: ComponentType
  /**
   * Shown outside Grist on a deployed URL (`/latest/`, `/dev/`, `/v<version>/`).
   * Defaults to a page linking every channel and version, with the URL to
   * paste into Grist.
   */
  ReleasePage?: ComponentType<{ channel: DeployChannel }>
}

/** `mountGristWidget()`'s older form: the widget's props, and where to render. */
export type MountGristWidgetConfig = GristWidgetAppProps & {
  /** The element to render into, or its CSS selector. Defaults to `#root`. */
  root?: Element | string
}

/**
 * A widget's entry module, `src/app/App.tsx`, as `import * as entry` gives
 * it: the widget as its default export, its declaration as `widget`, and
 * optionally its `Settings`, and its own `Alerts`, `LocalDevPage` and
 * `ReleasePage`.
 *
 * Everything a widget customises lives there, in its own file: the
 * template's `src/main.tsx` stays the same in every widget, and
 * `create-grist-widget upgrade` can rewrite it without losing anything. A
 * widget made before `defineGristWidget` exports `GRIST_OPTIONS` and
 * `WIDGET_METADATA` instead, which still works.
 */
export type GristWidgetEntry = {
  default: ComponentType
  widget?: GristWidget
  GRIST_OPTIONS?: UseGristOptions
  WIDGET_METADATA?: GristWidgetMetadata
  Alerts?: GristWidgetAppProps["Alerts"]
  Settings?: GristWidgetAppProps["Settings"]
  LocalDevPage?: GristWidgetAppProps["LocalDevPage"]
  ReleasePage?: GristWidgetAppProps["ReleasePage"]
}

/**
 * @internal An entry module, as opposed to `{ App, options }`: it has a
 * default export. A widget's module may also export its component as `App`,
 * so `App` alone doesn't tell them apart.
 */
export function isGristWidgetEntry(value: object): value is GristWidgetEntry {
  return "default" in value && value.default != null
}

/** The props {@link GristWidgetApp} takes, from a widget's entry module. */
export function entryProps(entry: GristWidgetEntry, dev = false): GristWidgetAppProps {
  const widget = isGristWidget(entry.widget) ? entry.widget : undefined
  const options = widget?.options ?? entry.GRIST_OPTIONS
  if (!options) {
    throw new Error(
      "mountGristWidget: src/app/App.tsx exports neither `widget` (defineGristWidget) nor `GRIST_OPTIONS`."
    )
  }
  const props: GristWidgetAppProps = {
    App: entry.default,
    options,
    metadata: widget?.metadata ?? entry.WIDGET_METADATA,
    dev,
  }
  if ("Alerts" in entry) props.Alerts = entry.Alerts
  if (entry.Settings) props.Settings = entry.Settings
  if (entry.LocalDevPage) props.LocalDevPage = entry.LocalDevPage
  if (entry.ReleasePage) props.ReleasePage = entry.ReleasePage
  return props
}

/** A mounted widget: `unmount()` removes it and its React root. */
export type MountedGristWidget = {
  unmount: () => void
}

/**
 * Render a widget into the page: everything `src/main.tsx` used to wire by
 * hand.
 *
 * ```tsx
 * import { mountGristWidget } from "grist-widget-sdk/app"
 * import "./index.css"
 * import * as entry from "./app/App"
 *
 * mountGristWidget(entry, { dev: import.meta.env.DEV })
 * ```
 *
 * It reads the entry module's exports ({@link GristWidgetEntry}): the widget,
 * its declaration and any page it replaces. The older form,
 * `mountGristWidget({ App, options: GRIST_OPTIONS, dev })`, still works.
 *
 * Inside Grist, the widget renders in {@link GristWidgetProvider} and
 * {@link GristBoundary}, which gates on its mapped columns when it declares
 * any, and follows Grist's light/dark theme. Outside Grist, where there is
 * nothing to connect to, the page shows `LocalDevPage` on the dev server and
 * `ReleasePage` on a deployed URL.
 */
export function mountGristWidget(entry: GristWidgetEntry, options?: { dev?: boolean; root?: Element | string }): MountedGristWidget
/** The older form: the widget's props, as an object. Prefer `mountGristWidget(entry, { dev })`. */
export function mountGristWidget(config: MountGristWidgetConfig): MountedGristWidget
export function mountGristWidget(
  config: MountGristWidgetConfig | GristWidgetEntry,
  entryOptions: { dev?: boolean; root?: Element | string } = {}
): MountedGristWidget {
  const { root = "#root", ...props } =
    isGristWidgetEntry(config) ? { ...entryProps(config, entryOptions.dev), root: entryOptions.root } : config
  const container = typeof root === "string" ? document.querySelector(root) : root
  if (!container) {
    throw new Error(`mountGristWidget: no element matches "${String(root)}" to render the widget into.`)
  }

  const reactRoot = createRoot(container)
  reactRoot.render(
    <StrictMode>
      <GristWidgetApp {...props} />
    </StrictMode>
  )
  return { unmount: () => reactRoot.unmount() }
}

/**
 * The tree {@link mountGristWidget} renders, as a component: for a test, or
 * for a page that manages its own React root.
 */
export function GristWidgetApp({
  App,
  options,
  metadata,
  dev = false,
  Alerts = WidgetAlerts,
  Settings,
  LocalDevPage = DefaultLocalDevPage,
  ReleasePage = DefaultReleasePage,
}: GristWidgetAppProps) {
  const Wrap = Alerts ?? PassThrough
  if (isEmbedded()) {
    // A widget with Settings gets Grist's "Open configuration" unless it says otherwise.
    const ready = Settings && options.hasCustomOptions === undefined ? { ...options, hasCustomOptions: true } : options
    return (
      <GristWidgetProvider options={ready}>
        <PageMetadata metadata={metadata} />
        <GristChromeLocaleProvider languages={metadata?.languages}>
          <EmbeddedThemeProvider>
            <GristBoundary>
              <ReportUrlProvider url={metadata?.reportUrl}>
                <div style={FILL}>
                  <MaybeSettings Settings={Settings}>
                    <Wrap>
                      <WidgetCrashBoundary>
                        <Suspense fallback={null}>
                          <App />
                        </Suspense>
                      </WidgetCrashBoundary>
                    </Wrap>
                  </MaybeSettings>
                </div>
              </ReportUrlProvider>
            </GristBoundary>
          </EmbeddedThemeProvider>
        </GristChromeLocaleProvider>
      </GristWidgetProvider>
    )
  }

  const channel = parseDeployPath(window.location.pathname).channel
  return (
    <StandaloneThemeProvider>
      <PageMetadata metadata={metadata} />
      <div style={FILL}>{dev ? <LocalDevPage /> : <ReleasePage channel={channel} />}</div>
    </StandaloneThemeProvider>
  )
}

const FILL = { minHeight: "100%", width: "100%" } as const

/** A Grist custom widget only ever runs in Grist's iframe. */
function isEmbedded(): boolean {
  return typeof window !== "undefined" && window.self !== window.top
}

/** The page's title and description, from the widget's declaration. */
function PageMetadata({ metadata }: { metadata: GristWidgetAppProps["metadata"] }) {
  usePageMetadata(metadata?.title ? { title: metadata.title, description: metadata.description ?? "" } : null)
  return null
}

/** The Settings view over the widget and its alerts, when the widget has Settings. */
function MaybeSettings({ Settings, children }: { Settings?: ComponentType; children: ReactNode }) {
  return Settings ? <WithSettingsView Settings={Settings}>{children}</WithSettingsView> : <>{children}</>
}

function PassThrough({ children }: { children: ReactNode }) {
  return <>{children}</>
}
