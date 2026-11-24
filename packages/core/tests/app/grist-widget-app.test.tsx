/**
 * `GristWidgetApp` / `mountGristWidget()` / `useTheme()` — see /docs/sdk/api/app
 *
 * Inside Grist: the widget renders under the provider and boundary (gated on
 * mapped columns when it declares any) and follows Grist's theme. Outside
 * Grist: the local-dev page or the release page, with the shadcn-style
 * saved theme and `d` shortcut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { lazy, useEffect, useState } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { GristWidgetApp, mountGristWidget, useTheme, type DeployChannel } from "../../src/app"
import { WidgetAlerts } from "../../src/app/chrome/widget-alerts"
import { GristWidgetProvider, useGrist } from "../../src/sdk"
import { renderWithGrist } from "../../src/emulator/testing"
import { presets } from "../../src/emulator"

function Widget() {
  const { theme, resolvedTheme } = useTheme()
  return (
    <p data-testid="widget">
      widget {theme} {resolvedTheme}
    </p>
  )
}

function ReleasePage({ channel }: { channel: DeployChannel }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <p data-testid="release">{JSON.stringify(channel)}</p>
      <p data-testid="theme">
        {theme} {resolvedTheme}
      </p>
      <button onClick={() => setTheme("dark")}>dark</button>
      <input aria-label="field" />
    </div>
  )
}

/** jsdom has no matchMedia; this one reports the given OS setting. */
function stubColorScheme(dark: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

/** Undo renderWithGrist's iframe fake: `window.top === window.self` again. */
function notEmbedded() {
  Object.defineProperty(window, "top", { configurable: true, get: () => window.self })
}

const htmlClass = () => document.documentElement.className

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ""
  stubColorScheme(false)
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  cleanup()
  notEmbedded()
})

describe("inside Grist", () => {
  it("renders the widget inside the alerts wrapper once Grist is ready", async () => {
    function Alerts({ children }: { children: React.ReactNode }) {
      return <section data-testid="alerts">{children}</section>
    }
    renderWithGrist(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} Alerts={Alerts} />, {
      emulator: { document: presets.blank() },
    })
    const widget = await screen.findByTestId("widget")
    expect(screen.getByTestId("alerts")).toContainElement(widget)
  })

  it("waits for the declared columns to be mapped", async () => {
    const options = { requiredAccess: "read table" as const, columns: [{ name: "Title" }] }
    const { emulator } = renderWithGrist(<GristWidgetApp App={Widget} options={options} />, {
      emulator: {
        document: {
          generatedAt: "1970-01-01T00:00:00.000Z",
          docName: "Test",
          mode: "schema+data",
          tables: { Table1: { columns: { Title: { type: "Text" } }, rows: [{ id: 1, Title: "a" }] } },
        },
      },
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)))
    expect(screen.queryByTestId("widget")).toBeNull()

    act(() => emulator.setColumnMappings({ Title: "Title" }))
    expect(await screen.findByTestId("widget")).toBeInTheDocument()
  })

  it("renders a lazily loaded widget", async () => {
    const LazyWidget = lazy(async () => ({ default: Widget }))
    renderWithGrist(<GristWidgetApp App={LazyWidget} options={{ requiredAccess: "read table" }} />, {
      emulator: { document: presets.blank() },
    })
    expect(await screen.findByTestId("widget")).toBeInTheDocument()
  })

  it("follows Grist's theme, and the OS setting until Grist sends one", async () => {
    stubColorScheme(true)
    const { emulator } = renderWithGrist(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} />, {
      emulator: { document: presets.blank() },
    })
    await screen.findByTestId("widget")
    expect(screen.getByTestId("widget")).toHaveTextContent("widget system dark")
    expect(htmlClass()).toBe("dark")

    act(() => emulator.theme.set("light"))
    await waitFor(() => expect(htmlClass()).toBe("light"))
    expect(screen.getByTestId("widget")).toHaveTextContent("widget light light")

    act(() => emulator.theme.set("dark"))
    await waitFor(() => expect(htmlClass()).toBe("dark"))
  })

  it("ignores the d shortcut: Grist owns the theme", async () => {
    const { emulator } = renderWithGrist(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} />, {
      emulator: { document: presets.blank() },
    })
    await screen.findByTestId("widget")
    act(() => emulator.theme.set("light"))
    await waitFor(() => expect(htmlClass()).toBe("light"))

    fireEvent.keyDown(window, { key: "d" })
    expect(htmlClass()).toBe("light")
    expect(localStorage.getItem("theme")).toBeNull()
  })
})

/** Whether `el` or one of its ancestors is inert (jsdom keeps the property, without its effect). */
function hasInertAncestor(el: HTMLElement): boolean {
  let node: HTMLElement | null = el
  while (node) {
    if ((node as HTMLElement & { inert?: boolean }).inert) return true
    node = node.parentElement
  }
  return false
}

describe("the Settings view", () => {
  function Counter() {
    const w = useGrist()
    const [n, setN] = useState(0)
    return (
      <div>
        <p data-testid="widget">count {n}</p>
        <button onClick={() => setN((x) => x + 1)}>more</button>
        <button onClick={w.openConfiguration}>open settings</button>
      </div>
    )
  }
  function Settings() {
    const w = useGrist()
    return (
      <label>
        Compact
        <input type="checkbox" checked={w.widgetOptions?.compact === true} onChange={(e) => void w.patchWidgetOptions({ compact: e.target.checked })} />
      </label>
    )
  }
  const renderApp = (widgetOptions: Record<string, unknown> = {}, readOnly = false) =>
    renderWithGrist(<GristWidgetApp App={Counter} options={{ requiredAccess: "full" }} Settings={Settings} />, {
      readOnly,
      emulator: { document: presets.blank(), widgetOptions },
    })

  it("asks Grist for its \"Open configuration\", which opens the view", async () => {
    const { emulator } = renderApp()
    await screen.findByTestId("widget")
    expect(emulator.state.configuration?.hasCustomOptions).toBe(true)
    await act(() => emulator.openConfiguration())
    expect(await screen.findByRole("dialog", { name: "Settings" })).toBeInTheDocument()
  })

  it("fills the panel: a header, a Back to widget button, the fields; the widget stays mounted, its state kept", async () => {
    renderApp()
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "more" }))
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    const view = await screen.findByRole("dialog", { name: "Settings" })
    expect(view).toHaveStyle({ position: "fixed" })
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    // The first field has the focus.
    expect(screen.getByLabelText("Compact")).toHaveFocus()
    fireEvent.click(screen.getByRole("button", { name: /Back to widget/ }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByTestId("widget")).toHaveTextContent("count 1")
  })

  it("goes back on Escape", async () => {
    renderApp()
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    fireEvent.keyDown(await screen.findByLabelText("Compact"), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  it("says to click Grist's Save while the new options are a draft, until the view closes", async () => {
    renderApp()
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    expect(screen.queryByText(/click Save at the top of this section/)).not.toBeInTheDocument()
    fireEvent.click(await screen.findByLabelText("Compact"))
    expect(await screen.findByText(/click Save at the top of this section/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Back to widget/ }))
    fireEvent.click(await screen.findByRole("button", { name: "open settings" }))
    await screen.findByRole("dialog", { name: "Settings" })
    expect(screen.queryByText(/click Save at the top of this section/)).not.toBeInTheDocument()
  })

  it("drops the reminder on Grist's Revert (the saved options come back)", async () => {
    const { emulator } = renderApp({ compact: false })
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    fireEvent.click(await screen.findByLabelText("Compact"))
    await screen.findByText(/click Save at the top of this section/)
    await act(() => emulator.setOptions({ compact: false }))
    await waitFor(() => expect(screen.queryByText(/click Save at the top of this section/)).not.toBeInTheDocument())
  })

  it("says why settings can't be kept on a read-only document", async () => {
    renderApp({}, true)
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    expect(await screen.findByText(/open read-only: settings can't be saved/)).toBeInTheDocument()
  })

  it("gives the focus back to the widget's button, with the widget no longer inert", async () => {
    // jsdom has no inert. As in a browser: focus() inside an inert element does
    // nothing, and making the focused element inert takes the focus away.
    const inert = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "inert")
    const flags = new WeakMap<HTMLElement, boolean>()
    Object.defineProperty(HTMLElement.prototype, "inert", {
      configurable: true,
      get(this: HTMLElement) {
        return flags.get(this) ?? false
      },
      set(this: HTMLElement, value: boolean) {
        flags.set(this, value)
        if (value && document.activeElement instanceof HTMLElement && this.contains(document.activeElement)) document.activeElement.blur()
      },
    })
    const focus = HTMLElement.prototype.focus
    const spy = vi.spyOn(HTMLElement.prototype, "focus").mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (hasInertAncestor(this)) return
      focus.call(this, options)
    })
    try {
      renderApp()
      await screen.findByTestId("widget")
      const button = screen.getByRole("button", { name: "open settings" })
      button.focus()
      fireEvent.click(button)
      await screen.findByRole("dialog", { name: "Settings" })
      fireEvent.click(screen.getByRole("button", { name: /Back to widget/ }))
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
      expect(button).toHaveFocus()
    } finally {
      spy.mockRestore()
      if (inert) Object.defineProperty(HTMLElement.prototype, "inert", inert)
      else delete (HTMLElement.prototype as { inert?: boolean }).inert
    }
  })

  it("leaves Escape to a popover inside the settings that handles it", async () => {
    function WithPopover() {
      return <input aria-label="search" onKeyDown={(e) => e.key === "Escape" && e.preventDefault()} />
    }
    renderWithGrist(<GristWidgetApp App={Counter} options={{ requiredAccess: "full" }} Settings={WithPopover} />, {
      emulator: { document: presets.blank() },
    })
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    fireEvent.keyDown(await screen.findByLabelText("search"), { key: "Escape" })
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument()
  })

  it("shows why the options can't be written over (ADR 0017)", async () => {
    renderWithGrist(
      <GristWidgetApp App={Counter} options={{ requiredAccess: "full", optionsVersion: 1 }} Settings={Settings} />,
      { emulator: { document: presets.blank(), widgetOptions: { compact: true, __version: 3 } } }
    )
    await screen.findByTestId("widget")
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    await screen.findByRole("dialog", { name: "Settings" })
    expect(screen.getByRole("alert")).toHaveTextContent(/version/i)
  })

  it("isn't there for a widget without Settings", async () => {
    const { emulator } = renderWithGrist(<GristWidgetApp App={Counter} options={{ requiredAccess: "full" }} />, {
      emulator: { document: presets.blank() },
    })
    await screen.findByTestId("widget")
    expect(emulator.state.configuration?.hasCustomOptions).toBeFalsy()
    fireEvent.click(screen.getByRole("button", { name: "open settings" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("default alerts", () => {
  it("list what needs attention above the widget", async () => {
    renderWithGrist(
      <GristWidgetProvider options={{ requiredAccess: "read table", columns: [{ name: "Title" }] }}>
        <WidgetAlerts>
          <p>widget body</p>
        </WidgetAlerts>
      </GristWidgetProvider>,
      { emulator: { document: presets.blank() } }
    )
    // Grist hasn't reported the mapping of the declared column yet.
    const alert = await screen.findByRole("status")
    expect(alert).toHaveTextContent("Column mapping")
    expect(alert).toHaveTextContent("Waiting for Grist to report column mappings.")
    expect(screen.getByText("widget body")).toBeInTheDocument()
  })

  it("keep the widget mounted, and its state, when an alert comes and goes", async () => {
    let mounts = 0
    function Draft() {
      const w = useGrist()
      const [text, setText] = useState("")
      useEffect(() => void (mounts += 1), [])
      return (
        <>
          <input aria-label="draft" value={text} onChange={(e) => setText(e.target.value)} />
          <button onClick={() => void w.applyActions([["NoSuchAction"]]).catch(() => undefined)}>fail</button>
        </>
      )
    }
    renderWithGrist(<GristWidgetApp App={Draft} options={{ requiredAccess: "full" }} />, { emulator: { document: presets.blank() } })
    fireEvent.change(await screen.findByLabelText("draft"), { target: { value: "half-typed" } })
    fireEvent.click(screen.getByRole("button", { name: "fail" }))
    expect(await screen.findByText("Action error")).toBeInTheDocument()
    expect(screen.getByLabelText("draft")).toHaveValue("half-typed")
    expect(mounts).toBe(1)
  })

  it("links the widget's reportUrl under a failed write", async () => {
    function Fails() {
      const w = useGrist()
      return <button onClick={() => void w.applyActions([["NoSuchAction"]]).catch(() => undefined)}>fail</button>
    }
    const url = "https://github.com/acme/widgets/issues/new?template=widget-bug.yml&widget=kanban-board"
    renderWithGrist(<GristWidgetApp App={Fails} options={{ requiredAccess: "full" }} metadata={{ reportUrl: url }} />, {
      emulator: { document: presets.blank() },
    })
    expect(screen.queryByRole("link", { name: "Report a problem" })).toBeNull()
    fireEvent.click(await screen.findByRole("button", { name: "fail" }))
    expect(await screen.findByText("Action error")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Report a problem" })
    expect(link).toHaveAttribute("href", url)
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  describe("a widget that throws while rendering", () => {
    // The boundary throws the error again outside React, as an uncaught error:
    // these tests take it from the window, which also keeps Vitest from
    // failing them. Without a listener, a crashing widget's test fails, as before.
    let uncaught: unknown[] = []
    const take = (e: ErrorEvent) => {
      e.preventDefault()
      uncaught.push(e.error)
    }
    beforeEach(() => {
      uncaught = []
      vi.spyOn(console, "error").mockImplementation(() => undefined)
      window.addEventListener("error", take)
    })
    afterEach(() => {
      window.removeEventListener("error", take)
      vi.restoreAllMocks()
    })

    function Broken(): never {
      throw new Error("boom")
    }

    it("shows that it stopped working, with a reload and the report link, and leaves the error uncaught", async () => {
      renderWithGrist(<GristWidgetApp App={Broken} options={{ requiredAccess: "read table" }} metadata={{ reportUrl: "https://example.com/report" }} />, {
        emulator: { document: presets.blank() },
      })
      expect(await screen.findByRole("heading", { name: "The widget stopped working" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Reload the widget" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Report a problem" })).toHaveAttribute("href", "https://example.com/report")
      // A test runner, the real-Grist check and the console still see it.
      // React 18 also dispatches it while retrying the render: present, maybe more than once.
      // (React 18 marks the error with a property of its own: compare the message.)
      await waitFor(() => expect(uncaught.some((e) => e instanceof Error && e.message === "boom")).toBe(true))
    })

    it("catches a falsy thrown value too", async () => {
      function ThrowsZero(): never {
        throw 0
      }
      renderWithGrist(<GristWidgetApp App={ThrowsZero} options={{ requiredAccess: "read table" }} />, { emulator: { document: presets.blank() } })
      expect(await screen.findByRole("heading", { name: "The widget stopped working" })).toBeInTheDocument()
      await waitFor(() => expect(uncaught).toContain(0))
    })

    it("offers no report link without a reportUrl, or with one that isn't http(s)", async () => {
      renderWithGrist(<GristWidgetApp App={Broken} options={{ requiredAccess: "read table" }} metadata={{ reportUrl: "javascript:alert(1)" }} />, {
        emulator: { document: presets.blank() },
      })
      expect(await screen.findByRole("heading", { name: "The widget stopped working" })).toBeInTheDocument()
      expect(screen.queryByRole("link")).toBeNull()
      cleanup()
      renderWithGrist(<GristWidgetApp App={Broken} options={{ requiredAccess: "read table" }} />, { emulator: { document: presets.blank() } })
      expect(await screen.findByRole("heading", { name: "The widget stopped working" })).toBeInTheDocument()
      expect(screen.queryByRole("link")).toBeNull()
    })
  })

  it("offers no report link under an access-level alert: a setting, not a bug", async () => {
    function Writes() {
      const w = useGrist()
      return <button onClick={() => void w.applyActions([["AddRecord", "Tasks", null, {}]]).catch(() => undefined)}>write</button>
    }
    const { emulator } = renderWithGrist(
      <GristWidgetApp App={Writes} options={{ requiredAccess: "full" }} metadata={{ reportUrl: "https://example.com/report" }} />,
      { emulator: { document: presets.todoList() } },
    )
    // Grist refusing the write for its access level, as it says it.
    vi.spyOn(emulator.grist!.docApi, "applyUserActions").mockRejectedValue(new Error("Access not granted. Current access level read table"))
    fireEvent.click(await screen.findByRole("button", { name: "write" }))
    expect(await screen.findByText("Access level")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Report a problem" })).toBeNull()
  })

  it("can be turned off with Alerts={null}", async () => {
    renderWithGrist(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} Alerts={null} />, {
      emulator: { document: presets.blank() },
    })
    const widget = await screen.findByTestId("widget")
    expect(widget.parentElement).toHaveStyle({ minHeight: "100%" })
  })
})

describe("outside Grist", () => {
  beforeEach(() => notEmbedded())

  it("shows the local-dev page on the dev server", () => {
    render(
      <GristWidgetApp
        App={Widget}
        options={{ requiredAccess: "read table" }}
        dev
        LocalDevPage={() => <p>local dev</p>}
      />
    )
    expect(screen.getByText("local dev")).toBeInTheDocument()
    expect(screen.queryByTestId("widget")).toBeNull()
  })

  it("shows the release page with the channel of the deployed URL", () => {
    window.history.replaceState(null, "", "/my-widget/v1.2.0/")
    render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} ReleasePage={ReleasePage} />)
    expect(screen.getByTestId("release")).toHaveTextContent('{"kind":"version","version":"1.2.0"}')
  })

  it("defaults to a local-dev page named after the widget", () => {
    document.title = "My Widget"
    render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} dev />)
    expect(screen.getByText("My Widget · local dev")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Not embedded in Grist" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "widget catalog" })).toHaveAttribute("href", "https://gristwidgets.com/widgets/")
    expect(document.body.textContent).not.toMatch(/create-grist-widget (list|use)/)
  })

  it("defaults to a release page linking every channel and version, with the URL to paste", async () => {
    document.title = "My Widget"
    window.history.replaceState(null, "", "/my-widget/v1.0.0/")
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { version: "1.0.0", publishedAt: "2026-10-01T00:00:00Z" },
        { version: "0.9.0", publishedAt: "2026-09-01T00:00:00Z" },
      ],
    }))
    vi.stubGlobal("fetch", fetchMock)
    try {
      render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} />)
      expect(screen.getByText("My Widget · v1.0.0")).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledWith("/my-widget/versions.json", { cache: "no-store" })

      const current = await screen.findByRole("link", { name: "v1.0.0" })
      expect(current).toHaveAttribute("href", "/my-widget/v1.0.0/")
      expect(current).toHaveAttribute("aria-current", "page")
      expect(screen.getByRole("link", { name: "v0.9.0" })).not.toHaveAttribute("aria-current")
      expect(screen.getByRole("link", { name: "latest" })).toHaveAttribute("href", "/my-widget/latest/")
      expect(screen.getByRole("link", { name: "dev" })).toHaveAttribute("href", "/my-widget/dev/")
      expect(screen.getByLabelText("Widget URL")).toHaveValue(window.location.href)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("on the widget catalog, links each major's channel and each release where it is served", async () => {
    window.history.replaceState(null, "", "/widgets/map/v0/")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { version: "1.0.0", publishedAt: "2026-12-01T00:00:00Z", path: "1.0.0/" },
          { version: "0.1.1", publishedAt: "2026-11-15T00:00:00Z", path: "0.1.1/" },
        ],
      })),
    )
    try {
      render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} />)
      const current = await screen.findByRole("link", { name: "v0" })
      expect(current).toHaveAttribute("href", "/widgets/map/v0/")
      expect(current).toHaveAttribute("aria-current", "page")
      expect(screen.getByRole("link", { name: "v1" })).toHaveAttribute("href", "/widgets/map/v1/")
      expect(screen.getByRole("link", { name: "v0.1.1" })).toHaveAttribute("href", "/widgets/map/0.1.1/")
      expect(screen.getByLabelText("Widget URL")).toHaveValue(window.location.href)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("on /dev/, says not to paste it into a document instead of offering it", async () => {
    window.history.replaceState(null, "", "/my-widget/dev/")
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => null })))
    try {
      render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} />)
      expect(await screen.findByRole("heading", { name: "Not for a Grist document" })).toBeInTheDocument()
      expect(screen.queryByLabelText("Widget URL")).not.toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("still links latest and dev when versions.json can't be read", async () => {
    window.history.replaceState(null, "", "/my-widget/latest/")
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => null })))
    try {
      render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} />)
      await waitFor(() => expect(screen.getByRole("link", { name: "latest" })).toHaveAttribute("aria-current", "page"))
      expect(screen.getAllByRole("link")).toHaveLength(2)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("follows the OS setting until a choice is saved", () => {
    stubColorScheme(true)
    render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} ReleasePage={ReleasePage} />)
    expect(screen.getByTestId("theme")).toHaveTextContent("system dark")
    expect(htmlClass()).toBe("dark")

    fireEvent.click(screen.getByText("dark"))
    expect(localStorage.getItem("theme")).toBe("dark")
  })

  it("uses the saved choice", () => {
    localStorage.setItem("theme", "dark")
    render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} ReleasePage={ReleasePage} />)
    expect(screen.getByTestId("theme")).toHaveTextContent("dark dark")
    expect(htmlClass()).toBe("dark")
  })

  it("switches between light and dark with d, except while typing", () => {
    render(<GristWidgetApp App={Widget} options={{ requiredAccess: "read table" }} ReleasePage={ReleasePage} />)
    expect(htmlClass()).toBe("light")

    fireEvent.keyDown(window, { key: "d" })
    expect(htmlClass()).toBe("dark")
    expect(localStorage.getItem("theme")).toBe("dark")

    fireEvent.keyDown(screen.getByLabelText("field"), { key: "d" })
    expect(htmlClass()).toBe("dark")

    fireEvent.keyDown(window, { key: "d", ctrlKey: true })
    expect(htmlClass()).toBe("dark")

    fireEvent.keyDown(window, { key: "d" })
    expect(htmlClass()).toBe("light")
  })
})

describe("useTheme() without a mounted widget", () => {
  it("reports the system theme instead of throwing, as in a unit test", () => {
    stubColorScheme(true)
    render(<Widget />)
    expect(screen.getByTestId("widget")).toHaveTextContent("widget system dark")
  })
})

describe("mountGristWidget()", () => {
  beforeEach(() => notEmbedded())

  it("renders into #root and unmounts", async () => {
    const root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)
    try {
      let mounted: ReturnType<typeof mountGristWidget> | undefined
      act(() => {
        mounted = mountGristWidget({
          App: Widget,
          options: { requiredAccess: "read table" },
          dev: true,
          LocalDevPage: () => <p>mounted</p>,
        })
      })
      expect(root).toHaveTextContent("mounted")
      act(() => mounted!.unmount())
      expect(root).toBeEmptyDOMElement()
    } finally {
      root.remove()
    }
  })

  it("reads an entry module that also exports its component as App", () => {
    const root = document.createElement("div")
    root.id = "root"
    document.body.appendChild(root)
    try {
      // `export function App` next to `export default App`: still an entry module.
      const entry = {
        default: Widget,
        App: Widget,
        GRIST_OPTIONS: { requiredAccess: "read table" as const },
        WIDGET_METADATA: { title: "Named App widget" },
        LocalDevPage: () => <p>entry page</p>,
      }
      let mounted: ReturnType<typeof mountGristWidget> | undefined
      act(() => {
        mounted = mountGristWidget(entry, { dev: true })
      })
      expect(root).toHaveTextContent("entry page")
      expect(document.title).toBe("Named App widget")
      act(() => mounted!.unmount())
    } finally {
      root.remove()
    }
  })

  it("says which element it couldn't find", () => {
    expect(() =>
      mountGristWidget({ App: Widget, options: { requiredAccess: "read table" }, root: "#missing" })
    ).toThrow('mountGristWidget: no element matches "#missing"')
  })
})
