import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"

import App, { widget } from "./App"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const rows = [
  { Title: "Write the spec", Status: "Doing", Notes: "Ask Léa" },
  { Title: "Ship it", Status: "To do", Notes: null },
  { Title: "Plan", Status: "Done", Notes: null },
]

const column = (name: string) => screen.getByRole("region", { name })
const rowsOf = (emulator: { state: { tables: Map<string, { rows: Record<string, unknown>[] }> } }) =>
  emulator.state.tables.get("Table1")!.rows

describe("Kanban board", () => {
  it("AC-1 puts each row in its status's column, saved order first", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    await act(() => emulator.setOptions({ columns: ["To do", "Doing"] }))
    await screen.findByRole("region", { name: "Done" })
    const names = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))
    expect(names).toEqual(["To do", "Doing", "Done"])
    expect(within(column("Doing")).getByRole("button", { name: /Write the spec/ })).toBeInTheDocument()
    expect(within(column("Doing")).getByText("Ask Léa")).toBeInTheDocument()
  })

  it("AC-2 moves a card to the next column with the right arrow key", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    await act(() => emulator.setOptions({ columns: ["To do", "Doing", "Done"] }))
    fireEvent.keyDown(await screen.findByRole("button", { name: /Ship it/ }), { key: "ArrowRight" })
    await waitFor(() => expect(rowsOf(emulator)[1]).toMatchObject({ Status: "Doing" }))
  })

  it("AC-2 moves a dragged card to the column it is dropped on", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    fireEvent.dragStart(await screen.findByRole("button", { name: /Plan/ }))
    fireEvent.drop(column("To do"))
    await waitFor(() => expect(rowsOf(emulator)[2]).toMatchObject({ Status: "To do" }))
  })

  it("AC-3 selects the card's row when it is clicked", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    fireEvent.click(await screen.findByRole("button", { name: /Plan/ }))
    const planId = rowsOf(emulator)[2].id
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(planId))
  })

  it("AC-4 adds an empty column and saves the order", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    fireEvent.change(await screen.findByRole("textbox", { name: "New column name" }), { target: { value: "Review" } })
    fireEvent.click(screen.getByRole("button", { name: "Add column" }))
    expect(await screen.findByRole("region", { name: "Review" })).toBeInTheDocument()
    expect(emulator.state.widgetOptions.columns).toEqual(["Doing", "To do", "Done", "Review"])
  })

  it("AC-5 moves a column right", async () => {
    const { emulator } = renderWithGrist(<App />, { widget, rows })
    fireEvent.click(await screen.findByRole("button", { name: "Move column Doing right" }))
    await waitFor(() => expect(emulator.state.widgetOptions.columns).toEqual(["To do", "Doing", "Done"]))
    await waitFor(() =>
      expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["To do", "Doing", "Done"]),
    )
  })

  it("AC-6 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    renderWithGrist(<App />, { widget, rows })
    expect(await screen.findByRole("button", { name: "Ajouter une colonne" })).toBeInTheDocument()
    expect(screen.getByText("3 cartes")).toBeInTheDocument()
  })

  it("AC-7 shows an HTML title as text", async () => {
    renderWithGrist(<App />, { widget, rows: [{ Title: "<img src=x onerror=alert(1)>", Status: "To do", Notes: null }] })
    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
  })

  it("AC-8 says rows will appear when the table is empty", async () => {
    renderWithGrist(<App />, { widget, rows: [] })
    expect(await screen.findByText(/No rows yet/)).toBeInTheDocument()
  })
})
