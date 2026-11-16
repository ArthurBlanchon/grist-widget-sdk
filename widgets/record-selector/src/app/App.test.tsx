import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"

import App, { MAX_RESULTS, widget } from "./App"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const rows = [
  { Title: "Acme", Subtitle: "Lyon", Search: ["Léa Martin"] },
  { Title: "Brindille", Subtitle: "Nantes", Search: ["Jean Dupont"] },
  { Title: "Éclair Studio", Subtitle: "Paris", Search: ["Zoé Petit"] },
]

const search = () => screen.getByRole("combobox", { name: "Search" })
const options = () => within(screen.getByRole("listbox")).queryAllByRole("option")
const type = (text: string) => fireEvent.change(search(), { target: { value: text } })
const tableRows = (emulator: { state: { tables: Map<string, { rows: { id: number }[] }> } }) =>
  emulator.state.tables.get("Table1")!.rows

describe("Record selector", () => {
  it("AC-1 lists every row with its title and subtitle when the search is empty", async () => {
    renderWithGrist(<App />, { widget, rows })
    await screen.findByRole("listbox")
    expect(options().map((o) => o.textContent)).toEqual(["AcmeLyon", "BrindilleNantes", "Éclair StudioParis"])
  })

  it("AC-2 keeps the rows whose title, subtitle or search column contains the text, ignoring case and accents", async () => {
    renderWithGrist(<App />, { widget, rows })
    await screen.findByRole("listbox")
    type("eclair")
    expect(options().map((o) => o.textContent)).toEqual(["Éclair StudioParis"])
    type("NANTES")
    expect(options().map((o) => o.textContent)).toEqual(["BrindilleNantes"])
    type("lea")
    expect(options().map((o) => o.textContent)).toEqual(["AcmeLyon"])
  })

  it("AC-3 selects a row when its result is clicked, or chosen with Enter", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    fireEvent.click(await screen.findByRole("option", { name: /Brindille/ }))
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(tableRows(emulator)[1].id))
    type("paris")
    fireEvent.keyDown(search(), { key: "Enter" })
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(tableRows(emulator)[2].id))
  })

  it("AC-4 marks the selected row's result as the current one", async () => {
    renderWithGrist(<App />, { widget, rows })
    fireEvent.click(await screen.findByRole("option", { name: /Acme/ }))
    await waitFor(() => expect(screen.getByRole("option", { name: /Acme/ })).toHaveAttribute("aria-current", "true"))
    expect(screen.getByRole("option", { name: /Brindille/ })).not.toHaveAttribute("aria-current")
  })

  it("AC-5 moves through the results with the arrow keys", async () => {
    renderWithGrist(<App />, { widget, rows })
    await screen.findByRole("listbox")
    expect(options()[0]).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(search(), { key: "ArrowDown" })
    fireEvent.keyDown(search(), { key: "ArrowDown" })
    expect(options()[2]).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(search(), { key: "ArrowDown" })
    expect(options()[2]).toHaveAttribute("aria-selected", "true")
    fireEvent.keyDown(search(), { key: "ArrowUp" })
    expect(options()[1]).toHaveAttribute("aria-selected", "true")
    expect(search()).toHaveAttribute("aria-activedescendant", options()[1].id)
  })

  it("AC-6 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    renderWithGrist(<App />, { widget, rows })
    expect(await screen.findByRole("combobox", { name: "Rechercher" })).toBeInTheDocument()
    expect(screen.getByText("3 lignes")).toBeInTheDocument()
  })

  it("AC-7 shows an HTML title as text", async () => {
    renderWithGrist(<App />, { widget, rows: [{ Title: "<img src=x onerror=alert(1)>", Subtitle: null, Search: [] }] })
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
  })

  it("AC-8 says when nothing matches", async () => {
    renderWithGrist(<App />, { widget, rows })
    await screen.findByRole("listbox")
    type("zzz")
    expect(screen.getByText("No row matches “zzz”.")).toBeInTheDocument()
  })

  it("AC-9 lists the first 200 of more matching rows, and says how many matched", async () => {
    const many = Array.from({ length: MAX_RESULTS + 50 }, (_, i) => ({ Title: `Client ${i}`, Subtitle: null, Search: [] }))
    renderWithGrist(<App />, { widget, rows: many })
    await screen.findByRole("listbox")
    expect(options()).toHaveLength(MAX_RESULTS)
    expect(screen.getByText(`Showing the first ${MAX_RESULTS} of ${MAX_RESULTS + 50} matching rows. Type more to narrow the search.`)).toBeInTheDocument()
  })
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
