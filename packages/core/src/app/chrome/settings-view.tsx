import { useLayoutEffect, useRef, type ComponentType, type CSSProperties, type ReactNode } from "react"

import { useGrist } from "../../sdk"
import SettingsPanel from "./settings-panel"

/**
 * The widget, and its Settings view over it while the configuration is open
 * (`useGrist().configurationOpen`: Grist's "Open configuration", or the
 * widget's own button calling `openConfiguration()`).
 *
 * The view fills the widget's panel, which is often small: a header (an
 * outlined "Back to widget" on the left, "Settings" in the middle), the
 * draft warning while Grist holds the widget's new options unsaved
 * (`optionsDraft`), then the widget's `Settings` in a scrolling area. The
 * widget stays mounted under it, inert, so it keeps its state (a scroll, a
 * zoom). Escape goes back, and the focus returns to what had it.
 */
export function WithSettingsView({ Settings, children }: { Settings: ComponentType; children: ReactNode }) {
  const w = useGrist()
  const widget = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const open = w.configurationOpen
  // `inert` on the widget under the view: nothing there takes focus or clicks.
  // Set on the element: React 18 doesn't know the attribute. What had the
  // focus is noted before (inert takes it away, in a browser) and gets it
  // back once inert is lifted.
  useLayoutEffect(() => {
    const el = widget.current
    if (!el) return
    if (open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      el.inert = true
    } else if (el.inert) {
      el.inert = false
      if (returnTo.current?.isConnected) returnTo.current.focus()
      returnTo.current = null
    }
  }, [open])
  return (
    <>
      <div ref={widget} aria-hidden={open || undefined} style={CONTENTS}>
        {children}
      </div>
      {open ? (
        <SettingsPanel Settings={Settings} close={w.closeConfiguration} draft={w.optionsDraft} readOnly={w.readOnly} issue={w.optionsIssue} />
      ) : null}
    </>
  )
}

const CONTENTS: CSSProperties = { display: "contents" }
