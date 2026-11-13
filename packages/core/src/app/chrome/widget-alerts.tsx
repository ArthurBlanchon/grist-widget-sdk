import type { CSSProperties, ReactNode } from "react"

import { useGristSdkAlerts, type GristSdkAlertDescriptor, type GristSdkAlertsOptions } from "../../sdk/helpers/grist-sdk-alerts"
import { tokens } from "./tokens"

const ALERT_OPTIONS: GristSdkAlertsOptions = {
  sectionNotLinkedHint:
    "In Grist, select this widget section on the page, then use Link to connect a table, card, or chart view as the selector.",
}

/**
 * The default `Alerts` of {@link mountGristWidget}: what needs the user's
 * attention (column mapping, access level, failed writes, an unlinked
 * section), above the widget. Renders nothing extra when all is well.
 */
export function WidgetAlerts({ children }: { children: ReactNode }) {
  const alerts = useGristSdkAlerts(ALERT_OPTIONS)
  if (alerts.length === 0) return <>{children}</>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.75rem 0.75rem 0" }}>
        {alerts.map((alert) => (
          <WidgetAlert key={alert.id} alert={alert} />
        ))}
      </div>
      {children}
    </div>
  )
}

function WidgetAlert({ alert }: { alert: GristSdkAlertDescriptor }) {
  const linkIcon = alert.kind === "section-not-linked" || alert.kind === "source-not-wired"
  return (
    <div role={alert.ariaRole} style={{ ...alertStyle, ...SEVERITY[alert.severity] }}>
      <span aria-hidden style={{ flexShrink: 0, marginTop: "0.125rem" }}>
        {linkIcon ? <LinkIcon /> : <WarningIcon />}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>{alert.title}</p>
        <p style={{ margin: "0.25rem 0 0", color: tokens.mutedForeground }}>{alert.message}</p>
      </div>
    </div>
  )
}

const alertStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  border: `1px solid ${tokens.border}`,
  borderRadius: tokens.radius,
  color: tokens.foreground,
  fontSize: "0.875rem",
  lineHeight: 1.5,
}

const SEVERITY: Record<GristSdkAlertDescriptor["severity"], CSSProperties> = {
  error: { borderColor: tokens.destructive, color: tokens.destructive },
  warning: { borderColor: "rgb(245 158 11 / 0.4)", background: "rgb(245 158 11 / 0.1)" },
  info: { background: "transparent" },
}

const ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

function WarningIcon() {
  return (
    <svg {...ICON}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg {...ICON}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" x2="16" y1="12" y2="12" />
    </svg>
  )
}
