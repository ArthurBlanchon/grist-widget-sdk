import { Suspense, useEffect, useId, useRef, type ComponentType, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"

import { useGrist } from "../../sdk"
import { useChromeMessages } from "../../sdk/chrome-messages"
import { tokens } from "./tokens"

/**
 * The widget, and its Settings view over it while the configuration is open
 * (`useGrist().configurationOpen`: Grist's "Open configuration", or the
 * widget's own button calling `openConfiguration()`).
 *
 * The view fills the widget's panel, which is often small: a "Settings"
 * header, a large "Back to widget" button, the draft warning while Grist
 * holds the widget's new options unsaved (`optionsDraft`), then the
 * widget's `Settings` in a scrolling area. The widget stays mounted under
 * it, inert, so it keeps its state (a scroll, a zoom). Escape goes back.
 */
export function WithSettingsView({ Settings, children }: { Settings: ComponentType; children: ReactNode }) {
  const w = useGrist()
  const widget = useRef<HTMLDivElement>(null)
  const open = w.configurationOpen
  // `inert` on the widget under the view: nothing there takes focus or clicks.
  // Set on the element: React 18 doesn't know the attribute.
  useEffect(() => {
    if (widget.current) widget.current.inert = open
  }, [open])
  return (
    <>
      <div ref={widget} aria-hidden={open || undefined} style={CONTENTS}>
        {children}
      </div>
      {open ? <SettingsView Settings={Settings} close={w.closeConfiguration} draft={w.optionsDraft} readOnly={w.readOnly} /> : null}
    </>
  )
}

function SettingsView({ Settings, close, draft, readOnly }: { Settings: ComponentType; close: () => void; draft: boolean; readOnly: boolean }) {
  const { locale, t } = useChromeMessages()
  const titleId = useId()
  const body = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  // Focus the first setting, or the heading; give it back to what had it on close.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const first = body.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? heading.current)?.focus()
    return () => {
      if (before?.isConnected) before.focus()
    }
  }, [])

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation()
      close()
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} lang={locale} onKeyDown={onKeyDown} style={PANEL}>
      <div style={HEADER}>
        <h2 id={titleId} ref={heading} tabIndex={-1} style={TITLE}>
          {t.settingsTitle}
        </h2>
        <button type="button" onClick={close} style={BACK}>
          <span aria-hidden>←</span> {t.settingsBack}
        </button>
        {draft && !readOnly ? (
          <p role="status" style={WARNING}>
            <WarningIcon />
            <span>{t.settingsDraft}</span>
          </p>
        ) : null}
        {readOnly ? <p style={NOTE}>{t.settingsReadOnly}</p> : null}
      </div>
      <div ref={body} style={BODY}>
        <Suspense fallback={null}>
          <Settings />
        </Suspense>
      </div>
    </div>
  )
}

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

const CONTENTS: CSSProperties = { display: "contents" }

const PANEL: CSSProperties = {
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

const TITLE: CSSProperties = { margin: 0, fontSize: "1rem", fontWeight: 600, outline: "none" }

const BACK: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  padding: "0.625rem 1rem",
  border: "none",
  borderRadius: tokens.radius,
  background: tokens.primary,
  color: tokens.primaryForeground,
  font: "inherit",
  fontWeight: 500,
  cursor: "pointer",
}

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
