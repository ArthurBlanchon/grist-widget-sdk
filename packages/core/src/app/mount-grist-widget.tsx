import { StrictMode, Suspense, type ComponentType, type ReactNode } from "react"
import { createRoot } from "react-dom/client"

import { GristBoundary, GristWidgetProvider, useWidgetMetadata } from "../sdk"
import type { GristWidget, UseGristOptions } from "../sdk"
import { isGristWidget } from "../sdk/define-widget"
import { LocalDevPage as DefaultLocalDevPage } from "./chrome/local-dev-page"
import { ReleasePage as DefaultReleasePage } from "./chrome/release-page"
import { WidgetAlerts } from "./chrome/widget-alerts"
import { parseDeployPath, type DeployChannel } from "./deploy-path"
import { EmbeddedThemeProvider, StandaloneThemeProvider } from "./widget-theme"

export type GristWidgetAppProps = {
  /** The widget. A `React.lazy()` component works too: its code then loads only inside Grist. */
  App: ComponentType
  /** The widget's `GRIST_OPTIONS`: access level, columns, and so on. */
  options: UseGristOptions
  /** The page's title and description (the widget's `WIDGET_METADATA`, or its declaration's). */
  metadata?: { title?: string; description?: string }
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
  /** Shown outside Grist on the local dev server. Defaults to a page pointing at `pnpm test` and the `dev` loop. */
  LocalDevPage?: ComponentType
  /**
   * Shown outside Grist on a deployed URL (`/latest/`, `/dev/`, `/v<version>/`).
   * Defaults to a page linking every channel and version, with the URL to
   * paste into Grist.
   */
  ReleasePage?: ComponentType<{ channel: DeployChannel }>
}

export type MountGristWidgetConfig = GristWidgetAppProps & {
  /** The element to render into, or its CSS selector. Defaults to `#root`. */
  root?: Element | string
}

/**
 * A widget's entry module, `src/app/App.tsx`, as `import * as entry` gives
 * it: the widget as its default export, its declaration as `widget` (or, in
 * a widget made before `defineGristWidget`, `GRIST_OPTIONS` and
 * `WIDGET_METADATA`), and optionally its own `Alerts`, `LocalDevPage` and
 * `ReleasePage`. Everything a widget customises lives there, in its own
 * file: the template's `src/main.tsx` stays the same in every widget, and
 * `create-grist-widget upgrade` can rewrite it without losing anything.
 */
export type GristWidgetEntry = {
  default: ComponentType
  widget?: GristWidget
  GRIST_OPTIONS?: UseGristOptions
  WIDGET_METADATA?: { title?: string; description?: string }
  Alerts?: GristWidgetAppProps["Alerts"]
  LocalDevPage?: GristWidgetAppProps["LocalDevPage"]
  ReleasePage?: GristWidgetAppProps["ReleasePage"]
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
  if (entry.LocalDevPage) props.LocalDevPage = entry.LocalDevPage
  if (entry.ReleasePage) props.ReleasePage = entry.ReleasePage
  return props
}

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
export function mountGristWidget(config: MountGristWidgetConfig): MountedGristWidget
export function mountGristWidget(
  config: MountGristWidgetConfig | GristWidgetEntry,
  entryOptions: { dev?: boolean; root?: Element | string } = {}
): MountedGristWidget {
  const { root = "#root", ...props } =
    "App" in config ? config : { ...entryProps(config, entryOptions.dev), root: entryOptions.root }
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
  LocalDevPage = DefaultLocalDevPage,
  ReleasePage = DefaultReleasePage,
}: GristWidgetAppProps) {
  const Wrap = Alerts ?? PassThrough
  if (isEmbedded()) {
    return (
      <GristWidgetProvider options={options}>
        <PageMetadata metadata={metadata} />
        <EmbeddedThemeProvider>
          <GristBoundary>
            <div style={FILL}>
              <Wrap>
                <Suspense fallback={null}>
                  <App />
                </Suspense>
              </Wrap>
            </div>
          </GristBoundary>
        </EmbeddedThemeProvider>
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
  useWidgetMetadata(metadata?.title ? { title: metadata.title, description: metadata.description ?? "" } : null)
  return null
}

function PassThrough({ children }: { children: ReactNode }) {
  return <>{children}</>
}
