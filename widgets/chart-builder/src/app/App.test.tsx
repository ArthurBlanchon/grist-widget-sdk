import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"
import { buildData, MAX_CATEGORIES, MAX_POINTS } from "./series"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

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

it("AC-11 shows the largest 29 categories and the others as one Other", () => {
  // 40 customers, customer i with i + 1 rows of 10.
  const rows = Array.from({ length: 40 }, (_, i) => Array.from({ length: i + 1 }, () => ({ label: `C${i}`, values: [10] }))).flat()
  const sum = buildData(rows, 1, "sum", "(blank)", "Other")
  expect(sum).toHaveLength(MAX_CATEGORIES)
  expect(sum.at(-1)).toEqual({ label: "Other", s0: [...Array(11).keys()].reduce((a, i) => a + (i + 1) * 10, 0) })
  expect(sum.map((d) => d.label)).toContain("C39")
  expect(sum.map((d) => d.label)).not.toContain("C0")
  // An average stays one of the rows' numbers, not of the totals.
  expect(buildData(rows, 1, "average", "(blank)", "Other").at(-1)).toMatchObject({ label: "Other", s0: 10 })
})

it("AC-11 ranks by value sign aside, and puts a category named Other in the Other", () => {
  // A large loss stays; a category already named "Other" joins the bucket, one label.
  const rows = [
    { label: "Loss", values: [-1000] },
    { label: "Other", values: [500] },
    ...Array.from({ length: 40 }, (_, i) => ({ label: `C${i}`, values: [i + 1] })),
  ]
  const data = buildData(rows, 1, "sum", "(blank)", "Other")
  expect(data.map((d) => d.label)).toContain("Loss")
  expect(data.filter((d) => d.label === "Other")).toHaveLength(1)
  // Other: the 500, and C0 to C11 (1 + … + 12).
  expect(data.at(-1)).toEqual({ label: "Other", s0: 500 + 78 })
})

it("AC-11 puts ordered categories together with their neighbours, in order, every row counted", () => {
  const days = Array.from({ length: 365 }, (_, i) => ({ label: `Day ${String(i + 1).padStart(3, "0")}`, values: [1] }))
  const line = buildData(days, 1, "sum", "(blank)", "Other", true)
  expect(line.length).toBeLessThanOrEqual(MAX_POINTS)
  expect(line[0]!.label).toBe("Day 001 – Day 004")
  expect(line.reduce((a, d) => a + Number(d.s0), 0)).toBe(365)
  // Dates as labels are ordered whatever the chart.
  const dates = days.map((d, i) => ({ label: new Date(Date.UTC(2026, 0, 1 + i)), values: d.values }))
  const bar = buildData(dates, 1, "sum", "(blank)", "Other")
  expect(bar[0]!.label).toBe("2026-01-01 – 2026-01-04")
  expect(bar.map((d) => d.label)).not.toContain("Other")
  // Under the limit, nothing changes.
  expect(buildData(days.slice(0, 100), 1, "sum", "(blank)", "Other", true)).toHaveLength(100)
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)

it("AC-volume holds with a distinct category for every row", () => expectVolume(<App />, widget, demo, { unique: ["Month"] }), VOLUME_TIMEOUT_MS)

it("AC-volume holds with a distinct category for every row, in a line chart", () =>
  expectVolume(<App />, widget, { ...demo, options: { ...demo.options, chart: "line" } }, { unique: ["Month"] }), VOLUME_TIMEOUT_MS)

it("AC-volume holds with a distinct category for every row, in a combined chart", () =>
  expectVolume(<App />, widget, { ...demo, options: { ...demo.options, chart: "combined" } }, { unique: ["Month"] }), VOLUME_TIMEOUT_MS)
