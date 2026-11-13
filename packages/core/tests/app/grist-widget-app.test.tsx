/**
 * `GristWidgetApp` / `mountGristWidget()` / `useTheme()` — see /docs/sdk/api/app
 *
 * Inside Grist: the widget renders under the provider and boundary (gated on
 * mapped columns when it declares any) and follows Grist's theme. Outside
 * Grist: the local-dev page or the release page, with the shadcn-style
 * saved theme and `d` shortcut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { lazy } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

import { GristWidgetApp, mountGristWidget, useTheme, type DeployChannel } from "../../src/app"
import { WidgetAlerts } from "../../src/app/chrome/widget-alerts"
import { GristWidgetProvider } from "../../src/sdk"
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
    expect(screen.getByText("npx create-grist-widget list")).toBeInTheDocument()
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

  it("says which element it couldn't find", () => {
    expect(() =>
      mountGristWidget({ App: Widget, options: { requiredAccess: "read table" }, root: "#missing" })
    ).toThrow('mountGristWidget: no element matches "#missing"')
  })
})
