import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"

import App, { widget } from "./App"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const rows = [
  { Group: "Travel", Label: "Train to Lyon", Across: "March", Value: 120 },
  { Group: "Food", Label: "Team lunch", Across: "March", Value: 80.5 },
  { Group: "Travel", Label: "Hotel", Across: "April", Value: 300 },
  { Group: "10", Label: "Ten", Across: "April", Value: 1 },
  { Group: "9", Label: "Nine", Across: "April", Value: 2 },
  { Group: null, Label: "Unsorted", Across: "April", Value: 5 },
]

/** The grouped view: every column mapped but Across. */
function grouped(given: Record<string, unknown>[] = rows) {
  const result = renderWithGrist(<App />, { widget, rows: given })
  result.emulator.setColumnMappings({ Group: "Group", Label: "Label", Value: "Value" })
  return result
}

const groupNames = () => screen.getAllByRole("button", { expanded: true }).map((b) => b.textContent?.replace(/^[▾▸]/, ""))
const linked = (emulator: ReturnType<typeof grouped>["emulator"]) => vi.spyOn(emulator.api.GristView, "setSelectedRows")

describe("Grouped view", () => {
  it("AC-1 groups rows by value, in order, each with its count", async () => {
    grouped()
    await screen.findByText("Travel")
    expect(groupNames()).toEqual(["9", "10", "Food", "Travel", "(blank)"])
    const travel = screen.getByText("Travel").closest("li")!
    expect(within(travel).getByText("2 rows")).toBeInTheDocument()
  })

  it("AC-2 puts blank values in a (blank) group, last", async () => {
    grouped()
    await screen.findByText("(blank)")
    expect(groupNames().at(-1)).toBe("(blank)")
    expect(within(screen.getByText("(blank)").closest("li")!).getByText("Unsorted")).toBeInTheDocument()
  })

  it("AC-3 totals each group's values, with average, minimum or maximum instead", async () => {
    grouped()
    const travel = (await screen.findByText("Travel")).closest("li")!
    expect(within(travel).getByRole("button", { name: /^Travel: 420\./ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Average" }))
    await waitFor(() => expect(within(travel).getByRole("button", { name: /^Travel: 210\./ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Maximum" }))
    expect(screen.getByRole("button", { name: "Maximum" })).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(within(travel).getByRole("button", { name: /^Travel: 300\./ })).toBeInTheDocument())
  })

  it("AC-4 collapses and expands a group, which lists its rows by label", async () => {
    grouped()
    const toggle = (await screen.findByText("Travel")).closest("button")!
    const travel = toggle.closest("li")!
    expect(within(travel).getByText("Train to Lyon")).toBeInTheDocument()
    expect(within(travel).getByText("Hotel")).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(within(travel).queryByText("Hotel")).not.toBeInTheDocument()
    fireEvent.click(toggle)
    expect(within(travel).getByText("Hotel")).toBeInTheDocument()
  })

  it("AC-5 selects a row in Grist when it is clicked", async () => {
    const { emulator } = grouped()
    fireEvent.click(await screen.findByRole("button", { name: /Hotel/ }))
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(3))
  })

  it("AC-6 filters the linked widgets to a group's rows, and back", async () => {
    const { emulator } = grouped()
    await screen.findByText("Travel")
    const spy = linked(emulator)
    const total = screen.getByRole("button", { name: /^Travel: 420\./ })
    fireEvent.click(total)
    expect(spy).toHaveBeenLastCalledWith([1, 3])
    expect(total).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(total)
    expect(spy).toHaveBeenLastCalledWith(null)
    expect(total).toHaveAttribute("aria-pressed", "false")
  })

  it("AC-7 becomes a pivot table with an Across column, with totals per row, column and in all", async () => {
    renderWithGrist(<App />, { widget, rows })
    const table = await screen.findByRole("table")
    const head = within(table).getAllByRole("columnheader").map((h) => h.textContent)
    expect(head).toEqual(["Groups", "April", "March", "All"])
    const travel = within(table).getByRole("rowheader", { name: "Travel" }).closest("tr")!
    expect(within(travel).getAllByRole("cell").map((c) => c.textContent)).toEqual(["300", "120", "420"])
    const all = within(table).getAllByRole("rowheader", { name: "All" })[0]!.closest("tr")!
    expect(within(all).getAllByRole("cell").map((c) => c.textContent)).toEqual(["308", "200.5", "508.5"])
  })

  it("AC-7 gives every pivot cell's button its total, as a screen reader reads it (#93)", async () => {
    renderWithGrist(<App />, { widget, rows })
    const table = await screen.findByRole("table")
    for (const button of within(table).getAllByRole("button")) {
      // The number shown is in the button's accessible name.
      expect(button.getAttribute("aria-label")).toContain(button.textContent)
    }
  })

  it("AC-8 filters the linked widgets to a pivot cell's rows", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    await screen.findByRole("table")
    const spy = linked(emulator)
    fireEvent.click(screen.getByRole("button", { name: "Travel, April: 300. Show only these rows in linked widgets" }))
    expect(spy).toHaveBeenLastCalledWith([3])
  })

  it("AC-9 counts a list cell under each of its values", async () => {
    grouped([{ Group: ["red", "blue"], Label: "Both", Across: null, Value: 1 }])
    await screen.findByText("red")
    expect(groupNames()).toEqual(["blue", "red"])
    expect(screen.getAllByText("Both")).toHaveLength(2)
  })

  it("AC-10 speaks French, and writes numbers the French way", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    renderWithGrist(<App />, { widget, rows })
    expect(await screen.findByRole("columnheader", { name: "Tout" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Food : 80,5\./ })).toBeInTheDocument()
  })

  it("AC-11 shows an HTML group value as text", async () => {
    grouped([{ Group: "<img src=x onerror=alert(1)>", Label: "x", Across: null, Value: 1 }])
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
  })

  it("AC-12 says when there are no rows", async () => {
    grouped([])
    expect(await screen.findByText(/No rows to group/)).toBeInTheDocument()
  })

  it("AC-13 shows groups, rows and columns some at a time, each with a button for the next, totals counting every row", async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ Group: `G${String(i).padStart(3, "0")}`, Label: `Row ${i}`, Across: `A${String(i % 30).padStart(2, "0")}`, Value: 1 }))
    const full = Array.from({ length: 65 }, (_, i) => ({ Group: "G000", Label: `Extra ${i}`, Across: "A00", Value: 1 }))
    grouped([...full, ...many])
    await screen.findByText("G000")
    expect(groupNames()).toHaveLength(50)
    // G000: 66 rows, 10 listed, then 50 more, then the last 6.
    const g000 = () => screen.getByRole("button", { name: /^G000: 66\./ }).closest("li")!
    expect(within(g000()).getAllByRole("listitem")).toHaveLength(11)
    fireEvent.click(within(g000()).getByRole("button", { name: "Show 50 more rows (56 not shown)" }))
    fireEvent.click(within(g000()).getByRole("button", { name: "Show 6 more rows (6 not shown)" }))
    expect(within(g000()).getAllByRole("listitem")).toHaveLength(66)
    fireEvent.click(screen.getByRole("button", { name: "Show 50 more groups (70 not shown)" }))
    expect(groupNames()).toHaveLength(100)
    fireEvent.click(screen.getByRole("button", { name: "Show 20 more groups (20 not shown)" }))
    expect(groupNames()).toHaveLength(120)
    expect(screen.queryByRole("button", { name: /more groups/ })).toBeNull()
    cleanup()

    renderWithGrist(<App />, { widget, rows: [...full, ...many] })
    const table = await screen.findByRole("table")
    expect(within(table).getAllByRole("columnheader")).toHaveLength(22)
    expect(within(table).getAllByRole("rowheader")).toHaveLength(51)
    const all = within(table).getAllByRole("rowheader", { name: "All" })[0]!.closest("tr")!
    expect(within(all).getAllByRole("cell").at(-1)!.textContent).toBe("185")
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more columns (10 not shown)" }))
    expect(within(table).getAllByRole("columnheader")).toHaveLength(32)
    expect(screen.queryByRole("button", { name: /more columns/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Show 50 more groups (70 not shown)" }))
    expect(within(table).getAllByRole("rowheader")).toHaveLength(101)
  })
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
it("AC-volume holds with a distinct group for every row", () => expectVolume(<App />, widget, demo, { unique: ["Category"] }), VOLUME_TIMEOUT_MS)
it("AC-volume holds with a distinct Across value for every row", () => expectVolume(<App />, widget, demo, { unique: ["Month"] }), VOLUME_TIMEOUT_MS)

/** The demo as a list (no Across), its expenses in `groups` categories. */
function listDemo(groups: number): typeof demo {
  const table = demo.tables.Expenses!
  return {
    ...demo,
    mapping: { Group: "Category", Label: "Person", Value: "Amount" },
    tables: { Expenses: { ...table, rows: Array.from({ length: groups * 2 }, (_, i) => ({ ...table.rows[i % table.rows.length]!, Category: `C${i % groups}` })) } },
  }
}

it("AC-volume holds as a list of 100 groups of 50 rows", () => expectVolume(<App />, widget, listDemo(100)), VOLUME_TIMEOUT_MS)
it("AC-volume holds as a list with a distinct group for every row", () => expectVolume(<App />, widget, listDemo(5), { unique: ["Category"] }), VOLUME_TIMEOUT_MS)
