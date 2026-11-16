import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const SALES: GristReplicaRow[] = [
  { id: 1, Month: "Jan", Revenue: 100, Costs: 60 },
  { id: 2, Month: "Feb", Revenue: 80, Costs: 70 },
  { id: 3, Month: "Jan", Revenue: 50, Costs: null },
  { id: 4, Month: "", Revenue: 5, Costs: 1 },
]

const doc = (rows: GristReplicaRow[] = SALES, options: Record<string, unknown> = {}): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Sales",
  mode: "schema+data",
  widgetOptions: options,
  tables: {
    Sales: {
      columns: { Month: { type: "Text", label: "Month" }, Revenue: { type: "Numeric", label: "Revenue" }, Costs: { type: "Numeric", label: "Costs" } },
      rows,
    },
  },
})

function setup({ rows, options, values = ["Revenue", "Costs"] }: { rows?: GristReplicaRow[]; options?: Record<string, unknown>; values?: string[] } = {}) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(rows, options), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings({ Label: "Month", Values: values })
  return result
}

/** The chart's data, as the screen-reader table gives it: label → cells. */
async function table() {
  const t = await screen.findByRole("table", { name: "The chart's data" })
  return Object.fromEntries(
    within(t)
      .getAllByRole("row")
      .slice(1)
      .map((row) => [within(row).getByRole("rowheader").textContent, within(row).getAllByRole("cell").map((c) => c.textContent)]),
  )
}

describe("Chart builder", () => {
  it("AC-1 groups rows by label in order, each series summed", async () => {
    setup()
    expect(await table()).toEqual({ Jan: ["150", "60"], Feb: ["80", "70"], "(blank)": ["5", "1"] })
  })

  it("AC-2 totals by average or count instead", async () => {
    const { emulator } = setup()
    await table()
    fireEvent.click(screen.getByRole("button", { name: "Average" }))
    await waitFor(async () => expect((await table()).Jan).toEqual(["75", "60"]))
    fireEvent.click(screen.getByRole("button", { name: "Count" }))
    await waitFor(async () => expect((await table()).Jan).toEqual(["2", "1"]))
    expect(emulator.state.widgetOptions).toMatchObject({ aggregate: "count" })
  })

  it("AC-3 names each series after its column, in the theme's chart colours", async () => {
    const { container } = setup()
    const t = await screen.findByRole("table", { name: "The chart's data" })
    await waitFor(() => expect(within(t).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Category", "Revenue", "Costs"]))
    const style = container.querySelector("style")?.textContent ?? ""
    expect(style).toContain("--color-s0: var(--chart-1)")
    expect(style).toContain("--color-s1: var(--chart-2)")
  })

  it("AC-4 draws bars, stacked bars, lines, areas, bars and lines, a pie or a radar", async () => {
    // jsdom can't measure the chart, so Recharts draws no SVG here: the test reads the kind the
    // widget asks Recharts for; CI's real-Grist check draws it in Chromium.
    const { container } = setup()
    await table()
    const kinds: Record<string, string> = { Bars: "bar", Stacked: "stacked", Lines: "line", Areas: "area", "Bars and lines": "combined", Pie: "pie", Radar: "radar" }
    for (const [name, kind] of Object.entries(kinds)) {
      fireEvent.click(screen.getByRole("button", { name }))
      await waitFor(() => expect(container.querySelector("[data-slot=chart]")).toHaveAttribute("data-kind", kind))
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true")
    }
  })

  it("AC-5 saves the chart and the total in the widget's options", async () => {
    const { emulator } = setup()
    await table()
    fireEvent.click(screen.getByRole("button", { name: "Lines" }))
    fireEvent.click(screen.getByRole("button", { name: "Average" }))
    await waitFor(() => expect(emulator.state.widgetOptions).toMatchObject({ chart: "line", aggregate: "average" }))
  })

  it("AC-6 gives the chart's data as a table for screen readers", async () => {
    setup()
    const t = await screen.findByRole("table", { name: "The chart's data" })
    expect(t).toHaveClass("sr-only")
    expect(within(t).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["Jan", "Feb", "(blank)"])
  })

  it("AC-7 puts rows with a blank label in a (blank) point", async () => {
    setup()
    expect((await table())["(blank)"]).toEqual(["5", "1"])
  })

  it("AC-8 says what to map when there is nothing to chart", async () => {
    setup({ rows: [] })
    expect(await screen.findByText(/Nothing to chart yet/)).toBeInTheDocument()
  })

  it("AC-9 speaks French and writes numbers the French way", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup({ rows: [{ id: 1, Month: "Jan", Revenue: 1234.5, Costs: 1 }], options: { aggregate: "sum" } })
    expect(await screen.findByRole("button", { name: "Secteurs" })).toBeInTheDocument()
    const t = await screen.findByRole("table", { name: "Les données du graphique" })
    expect(within(t).getAllByRole("cell")[0]!.textContent).toMatch(/1\s234,5/)
  })

  it("AC-10 shows an HTML label as text", async () => {
    setup({ rows: [{ id: 1, Month: "<img src=x onerror=alert(1)>", Revenue: 1, Costs: 1 }] })
    expect(Object.keys(await table())).toEqual(["<img src=x onerror=alert(1)>"])
    expect(document.querySelector("img")).toBeNull()
  })
})
