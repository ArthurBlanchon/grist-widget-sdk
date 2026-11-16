import { Component, createContext, useContext, type CSSProperties, type ErrorInfo, type ReactNode } from "react"

import { httpUrl } from "../../sdk/helpers/http-url"
import { pageStyle, tokens } from "./tokens"

/**
 * The widget's `reportUrl` (its declaration's), checked: http(s) only. The
 * chrome links it where something went wrong; nothing is sent anywhere.
 */
const ReportUrlContext = createContext<string | undefined>(undefined)

export function ReportUrlProvider({ url, children }: { url: string | undefined; children: ReactNode }) {
  return <ReportUrlContext.Provider value={httpUrl(url)}>{children}</ReportUrlContext.Provider>
}

/** "Report a problem", to the widget's `reportUrl` in a new tab; nothing when it has none. */
export function ReportProblemLink({ style }: { style?: CSSProperties }) {
  const url = useContext(ReportUrlContext)
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", ...style }}>
      Report a problem
    </a>
  )
}

type CrashState = { error: unknown }

/**
 * What the widget shows when it throws while rendering, instead of a blank
 * panel: that it stopped working, a button to reload it, and the report
 * link. The error goes to the console, as React's would.
 */
export class WidgetCrashBoundary extends Component<{ children: ReactNode }, CrashState> {
  state: CrashState = { error: null }

  static getDerivedStateFromError(error: unknown): CrashState {
    return { error: error ?? new Error("unknown error") }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("The widget stopped working:", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ ...pageStyle, padding: "1.5rem", gap: "0.75rem", color: tokens.foreground }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>The widget stopped working</h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: tokens.mutedForeground }}>
          Reload it to try again. If it happens again, report the problem: say what you did just before.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", fontSize: "0.875rem" }}>
          <button type="button" onClick={() => window.location.reload()} style={buttonStyle}>
            Reload the widget
          </button>
          <ReportProblemLink />
        </div>
      </div>
    )
  }
}

const buttonStyle: CSSProperties = {
  border: `1px solid ${tokens.border}`,
  borderRadius: tokens.radius,
  background: tokens.primary,
  color: tokens.primaryForeground,
  cursor: "pointer",
  font: "inherit",
  fontWeight: 500,
  padding: "0.375rem 0.75rem",
}
