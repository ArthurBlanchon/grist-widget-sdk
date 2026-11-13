import { useCallback, useState, type CSSProperties, type ReactNode } from "react"

import { accessDenied, accessLabel, deriveColumnMappingStatus } from "../runtime/derive"
import type { GristRuntimeState } from "../runtime/runtime"
import { useGristRuntime, useGristState } from "../use-grist"

export type GristBoundaryProps = {
  children: ReactNode
}

export type GristBoundaryActions = {
  reload: () => Promise<void>
  isReloading: boolean
}

const shellStyle: CSSProperties = {
  alignItems: "center",
  background: "var(--background)",
  boxSizing: "border-box",
  color: "var(--foreground)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: "100%",
  padding: "clamp(16px, 5vh, 32px)",
  width: "100%",
}

const cardStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 1px 3px rgb(0 0 0 / 0.12)",
  maxWidth: 420,
  padding: "20px 22px",
  textAlign: "center",
  width: "100%",
}

const titleStyle: CSSProperties = {
  color: "var(--foreground)",
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.35,
  margin: 0,
}

const messageStyle: CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: "10px 0 0",
}

const buttonStyle: CSSProperties = {
  background: "var(--background)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
  marginTop: 16,
  padding: "8px 14px",
}

type GristBoundaryScreenProps = {
  title: string
  message: string
  /** Affects WAI-ARIA role only (`alert` vs `status`); copy uses the same neutral styles. */
  tone?: "default" | "error"
  showRetry?: boolean
  actions?: GristBoundaryActions
  retryLabel?: string
  retryBusyLabel?: string
}

/** Centered full-viewport chrome for booting / unavailable / error states. */
export function GristBoundaryScreen({
  title,
  message,
  tone = "default",
  showRetry = false,
  actions,
  retryLabel = "Try reconnecting",
  retryBusyLabel = "Reconnecting…",
}: GristBoundaryScreenProps) {
  return (
    <div style={shellStyle} role={tone === "error" ? "alert" : "status"}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>{title}</h2>
        <p style={messageStyle}>{message}</p>
        {showRetry && actions ? (
          <button
            disabled={actions.isReloading}
            onClick={() => void actions.reload()}
            style={{
              ...buttonStyle,
              cursor: actions.isReloading ? "not-allowed" : "pointer",
              opacity: actions.isReloading ? 0.7 : 1,
            }}
            type="button"
          >
            {actions.isReloading ? retryBusyLabel : retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}

type Screen = { title: string; message: string; tone?: "default" | "error"; retry?: boolean }

/** What the boundary shows instead of the widget, or null to render it. */
export function boundaryScreen(state: GristRuntimeState, columns: Parameters<typeof deriveColumnMappingStatus>[0]): Screen | null {
  switch (state.connection) {
    case "connecting":
      return { title: "Connecting to Grist", message: "Asking Grist for the access this widget needs…" }
    case "not-embedded":
      return {
        title: "Open inside Grist",
        message: "Open this page as a custom widget inside a Grist document (it runs in an embedded panel, not on its own).",
        retry: true,
      }
    case "unavailable":
      return {
        title: "Open inside Grist",
        message: "The Grist plugin did not load. Reload the page, or open this URL as a custom widget inside a Grist document.",
        retry: true,
      }
    case "error":
      return {
        title: "Something went wrong",
        message: state.connectionError ?? "Something went wrong connecting to Grist. Try again, or reload the page.",
        tone: "error",
        retry: true,
      }
  }
  if (accessDenied(state)) {
    return {
      title: "More access needed",
      message: `Set Access level to at least "${accessLabel(state.declaredAccess)}" in the Custom widget settings.`,
      tone: "error",
      retry: true,
    }
  }
  const mapping = deriveColumnMappingStatus(columns, state.mappings)
  if (mapping.pending) return { title: "Connecting to Grist", message: "Waiting for Grist to report the column mapping…" }
  if (!mapping.ok) {
    return {
      title: "Map your columns",
      message:
        "Open the widget settings in Grist (Creator Panel → Custom widget) and connect each required column to your table.",
    }
  }
  return null
}

/**
 * Renders the widget once Grist is connected, has granted the access it
 * declares, and every required declared column is mapped; until then, a
 * screen that says what is missing (with a retry where one can help).
 * Requires `<GristWidgetProvider>`; `mountGristWidget()` renders both.
 */
export function GristBoundary({ children }: GristBoundaryProps) {
  const connection = useGristRuntime()
  if (!connection) throw new Error("<GristBoundary> must be used inside <GristWidgetProvider> (mountGristWidget renders both).")
  const state = useGristState(connection)
  const [isReloading, setIsReloading] = useState(false)
  const reload = useCallback(async () => {
    setIsReloading(true)
    try {
      await connection.runtime.reload()
    } catch (err) {
      console.error("[grist-widget-sdk] reload failed:", err)
    } finally {
      setIsReloading(false)
    }
  }, [connection])

  const screen = boundaryScreen(state, connection.runtime.options.columns)
  if (!screen) return <>{children}</>
  return (
    <GristBoundaryScreen
      title={screen.title}
      message={screen.message}
      tone={screen.tone}
      showRetry={screen.retry}
      actions={{ reload, isReloading }}
      retryLabel={screen.tone === "error" ? "Try again" : "Try reconnecting"}
      retryBusyLabel={screen.tone === "error" ? "Retrying…" : "Reconnecting…"}
    />
  )
}
