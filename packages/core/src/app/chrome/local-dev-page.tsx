import { useEffect, useState } from "react"

import {
  cardStyle,
  cardTextStyle,
  cardTitleStyle,
  codeStyle,
  eyebrowStyle,
  headingStyle,
  leadStyle,
  pageStyle,
} from "./tokens"
import { widgetTitle } from "./widget-title"

/**
 * Whether the widget has a demo page (`public/demo/`). The dev server serves
 * it at `demo/index.html` (Vite answers a bare `demo/` with the app's own page).
 */
function useHasDemo(): boolean | null {
  const [has, setHas] = useState<boolean | null>(null)
  useEffect(() => {
    if (typeof fetch !== "function") return
    let live = true
    fetch("demo/demo.grist", { method: "HEAD" })
      .then((res) => live && setHas(res.ok))
      .catch(() => live && setHas(false))
    return () => {
      live = false
    }
  }, [])
  return has
}

/**
 * Shown outside Grist on the dev server. Deliberately not a preview of the
 * widget: an emulator can't match real Grist. It points at the loops worth
 * trusting: the widget in real Grist running in this browser (the demo page,
 * grist-static, on this dev server's build, so edits reload in place),
 * `pnpm test`, and the `dev` branch's preview inside a Grist document.
 */
export function LocalDevPage() {
  const hasDemo = useHasDemo()
  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>{widgetTitle()} · local dev</p>
      <h1 style={headingStyle}>Not embedded in Grist</h1>
      <p style={leadStyle}>This is the local dev server: there's no Grist here to render the widget against.</p>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Open it in Grist, in this browser</h2>
        {hasDemo === false ? (
          <p style={cardTextStyle}>
            Run <code style={codeStyle}>pnpm demo --save</code> once (it needs Docker): it writes{" "}
            <code style={codeStyle}>public/demo/</code>, a document for this widget. Then{" "}
            <a href="demo/index.html">demo/index.html</a> opens it in real Grist, running in the browser, on this dev server&apos;s
            widget: edits reload in place.
          </p>
        ) : (
          <p style={cardTextStyle}>
            <a href="demo/index.html">Open demo/index.html</a>: real Grist running in the browser (no server, nothing saved), with
            this dev server&apos;s widget, so edits reload in place. Its document is{" "}
            <code style={codeStyle}>public/demo/demo.grist</code>: after changing the declared columns, run{" "}
            <code style={codeStyle}>pnpm demo --save</code> (Docker) to regenerate it.
          </p>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Check it against real Grist</h2>
        <p style={cardTextStyle}>
          Push to <code style={codeStyle}>dev</code>, then open its <code style={codeStyle}>/dev/</code> URL in a
          custom widget of a real Grist document: later pushes reload it there within seconds. Locally,{" "}
          <code style={codeStyle}>pnpm test</code> runs the widget against an emulated Grist.
        </p>
      </section>

      <section style={cardStyle}>
        <h2 style={cardTitleStyle}>Starting from another example?</h2>
        <p style={cardTextStyle}>
          <code style={codeStyle}>npx create-grist-widget list</code> shows the examples, and{" "}
          <code style={codeStyle}>npx create-grist-widget use &lt;example&gt;</code> swaps this widget for one.
        </p>
      </section>
    </main>
  )
}
