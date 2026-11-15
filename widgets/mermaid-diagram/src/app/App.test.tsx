import "@testing-library/jest-dom/vitest"
import { act } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor } from "grist-widget-sdk/emulator/testing"

import App, { widget } from "./App"

// Mermaid lays diagrams out with the browser's text metrics, which jsdom lacks: it is a
// stand-in here that records what it is given; CI's real-Grist check draws real ones.
const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(async (source: string) => {
    if (source.includes("oops")) throw new Error("Parse error on line 2")
    return true
  }),
  render: vi.fn(async (_id: string, source: string) => ({ svg: `<svg xmlns="http://www.w3.org/2000/svg" data-lines="${source.split("\n").length}"><text>drawn</text></svg>` })),
}))
vi.mock("mermaid", () => ({ default: mermaid }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  document.documentElement.classList.remove("dark")
})

const lastSource = () => mermaid.render.mock.calls.at(-1)?.[1] as string

function cell(diagram: string | null, select = true) {
  const r = renderWithGrist(<App />, { widget, rows: [{ Diagram: diagram, From: null, To: null, Label: null }] })
  r.emulator.setColumnMappings({ Diagram: "Diagram" })
  if (!select) r.emulator.selectRow(null)
  return r
}

function rows(list: { From: unknown; To: unknown; Label?: unknown }[]) {
  const r = renderWithGrist(<App />, { widget, rows: list.map((x) => ({ Diagram: null, Label: null, ...x })) })
  r.emulator.setColumnMappings({ From: "From", To: "To", Label: "Label" })
  return r
}

describe("Mermaid diagram", () => {
  it("AC-1 draws the selected row's Mermaid code", async () => {
    cell("flowchart TD\n  A --> B")
    await waitFor(() => expect(lastSource()).toBe("flowchart TD\n  A --> B"))
    expect(await screen.findByText("drawn")).toBeInTheDocument()
  })

  it("AC-2 draws a flowchart of the rows, a node per value and a labelled arrow per row", async () => {
    rows([
      { From: "Order", To: "Pay", Label: "checkout" },
      { From: "Pay", To: "Ship" },
    ])
    await waitFor(() => expect(lastSource()).toContain("flowchart LR"))
    expect(lastSource().split("\n")).toEqual(['flowchart LR', '  n0["Order"]', '  n1["Pay"]', '  n2["Ship"]', '  n0 -->|"checkout"| n1', "  n1 --> n2"])
  })

  it("AC-3 draws a value with Mermaid syntax in it as text", async () => {
    rows([{ From: 'A"] --> X["evil', To: "click A call alert()", Label: "a|b" }])
    await waitFor(() => expect(lastSource()).toContain("flowchart LR"))
    const src = lastSource()
    expect(src).toContain('n0["A#quot;] --> X[#quot;evil"]')
    expect(src).toContain('n1["click A call alert()"]')
    // One arrow line, between generated ids: the --> inside the quoted label is text.
    expect(src.split("\n").filter((l) => /^ {2}n\d+ -->/.test(l))).toEqual(['  n0 -->|"a|b"| n1'])
  })

  it("AC-4 says what Mermaid reports about an error", async () => {
    cell("flowchart TD\n  oops")
    expect(await screen.findByText("Mermaid can't draw this: Parse error on line 2")).toBeInTheDocument()
  })

  it("AC-5 runs Mermaid in its strict security mode", async () => {
    cell("flowchart TD\n  A --> B")
    await waitFor(() => expect(mermaid.initialize).toHaveBeenCalled())
    expect(mermaid.initialize.mock.calls.at(-1)![0]).toMatchObject({ securityLevel: "strict", startOnLoad: false })
  })

  it("AC-5 keeps the layout Dagre's: a diagram can't ask for ELK, which the widget doesn't ship", async () => {
    cell("---\nconfig:\n  layout: elk\n---\nflowchart TD\n  A --> B")
    await waitFor(() => expect(mermaid.initialize).toHaveBeenCalled())
    const config = mermaid.initialize.mock.calls.at(-1)![0]
    expect(config.layout).toBe("dagre")
    expect(config.secure).toEqual(expect.arrayContaining(["layout", "securityLevel", "secure"]))
  })

  it("AC-6 takes its colours from the theme, read again on a theme switch", async () => {
    cell("flowchart TD\n  A --> B")
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1))
    expect(mermaid.initialize.mock.calls[0]![0].themeVariables).toMatchObject({ primaryTextColor: expect.any(String), background: expect.any(String) })
    await act(async () => document.documentElement.classList.add("dark"))
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2))
  })

  it("AC-7 downloads the drawn diagram as an SVG file", async () => {
    URL.createObjectURL = vi.fn(() => "blob:svg")
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    cell("flowchart TD\n  A --> B")
    await screen.findByText("drawn")
    fireEvent.click(screen.getByRole("button", { name: "Download SVG" }))
    const blob = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob
    expect(blob.type).toBe("image/svg+xml")
    expect(click).toHaveBeenCalledOnce()
  })

  it("AC-8 says what to do when there is nothing to draw", async () => {
    const r = renderWithGrist(<App />, { widget, rows: [{ Diagram: null, From: null, To: null, Label: null }] })
    r.emulator.setColumnMappings({ Label: "Label" })
    expect(await screen.findByText(/Map a column holding Mermaid code/)).toBeInTheDocument()
    cleanup()
    cell("")
    expect(await screen.findByText(/This row's cell is empty/)).toBeInTheDocument()
    cleanup()
    cell("flowchart TD", false)
    expect(await screen.findByText(/No row is selected/)).toBeInTheDocument()
  })

  it("AC-9 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    cell("flowchart TD\n  A --> B")
    expect(await screen.findByRole("button", { name: "Télécharger le SVG" })).toBeInTheDocument()
  })
})
