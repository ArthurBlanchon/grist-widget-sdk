import { Suspense, useEffect, useId, useRef, type ComponentType, type CSSProperties, type KeyboardEvent } from "react"

import { useChromeMessages } from "../../sdk/chrome-messages"
import { WidgetCrashBoundary } from "./report-problem"
import { tokens } from "./tokens"

/**
 * The Settings view's panel (settings-view.tsx), while the configuration is
 * open: a header (an outlined "Back to widget" on the left, "Settings" in
 * the middle), the reminders, then the widget's `Settings`, scrolling. The
 * first field takes the focus; Escape closes, unless a popover inside
 * took it.
 */
export default function SettingsPanel({
  Settings,
  close,
  draft,
  readOnly,
  issue,
}: {
  Settings: ComponentType
  close: () => void
  draft: boolean
  readOnly: boolean
  issue: string | null
}) {
  const { locale, t } = useChromeMessages()
  const titleId = useId()
  const body = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  // The first setting, or the heading, takes the focus (WithSettingsView gives it back on close).
  useEffect(() => {
    const first = body.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? heading.current)?.focus()
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    // A popover inside the settings handles its own Escape first (Radix prevents the default).
    if (e.key === "Escape" && !e.defaultPrevented) {
      e.stopPropagation()
      close()
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} lang={locale} onKeyDown={onKeyDown} style={PANEL}>
      <style>{HEADER_CSS}</style>
      <div style={HEADER}>
        {/* One row: the way back on the left, the title in the middle; an empty third column
            balances the first, and gives way in a narrow panel (HEADER_CSS). */}
        <div className="gws-settings-bar">
          <button type="button" onClick={close} className="gws-settings-back">
            <span aria-hidden>←</span> {t.settingsBack}
          </button>
          <h2 id={titleId} ref={heading} tabIndex={-1} className="gws-settings-title">
            {t.settingsTitle}
          </h2>
          <span aria-hidden className="gws-settings-balance" />
        </div>
        {draft && !readOnly ? (
          <p role="status" style={WARNING}>
            <WarningIcon />
            <span>{t.settingsDraft}</span>
          </p>
        ) : null}
        {readOnly ? <p style={NOTE}>{t.settingsReadOnly}</p> : null}
        {/* ADR 0017: options from a newer version, or not migrated, are never written over. */}
        {issue ? (
          <p role="alert" style={ISSUE}>
            {issue}
          </p>
        ) : null}
      </div>
      <div ref={body} style={BODY}>
        <WidgetCrashBoundary>
          <Suspense fallback={null}>
            <Settings />
          </Suspense>
        </WidgetCrashBoundary>
      </div>
    </div>
  )
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'


const PANEL: CSSProperties = {
  containerType: "inline-size",
  containerName: "gws-settings",
  position: "fixed",
  inset: 0,
  zIndex: 50,
  display: "flex",
  flexDirection: "column",
  background: tokens.background,
  color: tokens.foreground,
  fontSize: "0.875rem",
  lineHeight: 1.5,
}

const HEADER: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "0.75rem 1rem",
  borderBottom: `1px solid ${tokens.border}`,
}

/**
 * The header row, in CSS: the button stays on one line, the title is centred
 * on the panel while there is room, and in the panel's space beside the
 * button below 22rem (a container query: the view's own width, not the
 * window's). The button's border follows the text colour, and its hover
 * the theme's accent. Class names are the SDK's own (gws-).
 */
const HEADER_CSS = `
.gws-settings-bar { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.5rem; }
.gws-settings-back {
  justify-self: start; white-space: nowrap; padding: 0.375rem 0.75rem;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent); border-radius: ${tokens.radius};
  background: transparent; color: ${tokens.foreground}; font: inherit; font-weight: 500; cursor: pointer;
}
.gws-settings-back:hover { background: var(--accent, rgb(0 0 0 / 0.05)); }
.gws-settings-back:focus-visible { outline: 2px solid var(--ring, ${tokens.foreground}); outline-offset: 2px; }
.gws-settings-title { margin: 0; min-width: 0; font-size: 1rem; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; outline: none; }
@container gws-settings (max-width: 22rem) {
  .gws-settings-bar { grid-template-columns: auto minmax(0, 1fr); }
  .gws-settings-balance { display: none; }
}
`

const WARNING: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  margin: 0,
  padding: "0.625rem 0.75rem",
  border: "1px solid rgb(245 158 11 / 0.6)",
  borderRadius: tokens.radius,
  background: "rgb(245 158 11 / 0.15)",
}

const NOTE: CSSProperties = { margin: 0, color: tokens.mutedForeground }

const ISSUE: CSSProperties = { margin: 0, color: tokens.destructive }

const BODY: CSSProperties = { flex: 1, minHeight: 0, overflowY: "auto", padding: "1rem" }

function WarningIcon() {
  return (
    <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "0.125rem" }}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}
