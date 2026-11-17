import { Component, createContext, useContext, type CSSProperties, type ReactNode } from "react"

import { useChromeMessages } from "../../sdk/chrome-messages"
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
  const { locale, t } = useChromeMessages()
  if (!url) return null
  return (
    <a lang={locale} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", ...style }}>
      {t.reportProblem}
    </a>
  )
}

type CrashState = { crashed: boolean }

/**
 * What the widget shows when it throws while rendering, instead of a blank
 * panel: that it stopped working, a button to reload it, and the report
 * link. The error stays uncaught for everything else: it is reported again
 * outside React (`reportError`), so a test runner (renderWithGrist), the
 * real-Grist check and the browser's console see it as before.
 */
export class WidgetCrashBoundary extends Component<{ children: ReactNode }, CrashState> {
  state: CrashState = { crashed: false }

  static getDerivedStateFromError(): CrashState {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    if (typeof reportError === "function") reportError(error)
    else
      setTimeout(() => {
        throw error
      })
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return <CrashScreen />
  }
}

function CrashScreen() {
  const { locale, t } = useChromeMessages()
  return (
    <div role="alert" lang={locale} style={{ ...pageStyle, padding: "1.5rem", gap: "0.75rem", color: tokens.foreground }}>
      <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{t.crashTitle}</h2>
      <p style={{ margin: 0, fontSize: "0.875rem", color: tokens.mutedForeground }}>{t.crashMessage}</p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", fontSize: "0.875rem" }}>
        <button type="button" onClick={() => window.location.reload()} style={buttonStyle}>
          {t.crashReload}
        </button>
        <ReportProblemLink />
      </div>
    </div>
  )
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
