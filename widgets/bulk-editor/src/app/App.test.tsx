import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { actionsOf, cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const day = (m: number, d: number) => Date.UTC(2026, m - 1, d) / 1000
const ROWS: GristReplicaRow[] = [
  { id: 1, Title: "Plan", Status: "To do", Done: false, Hours: 2, Due: day(3, 1), Total: 4 },
  { id: 2, Title: "Build", Status: "Doing", Done: false, Hours: 5, Due: day(3, 9), Total: 10 },
  { id: 3, Title: "Ship", Status: "Done", Done: true, Hours: 1, Due: null, Total: 2 },
]

const doc = (rows = ROWS): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Tasks",
  mode: "schema+data",
  tables: {
    Table1: {
      columns: {
        Title: { type: "Text", label: "Title" },
        Status: { type: "Choice", label: "Status", widgetOptions: { choices: ["To do", "Doing", "Done"] } },
        Done: { type: "Bool", label: "Done" },
        Hours: { type: "Numeric", label: "Hours" },
        Due: { type: "Date", label: "Due" },
        Total: { type: "Numeric", label: "Total", isFormula: true, formula: "$Hours * 2" },
      },
      rows,
    },
  },
})

function setup(target: string, rows?: GristReplicaRow[]) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(rows), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings({ Target: target })
  return result
}

const cells = (emulator: ReturnType<typeof setup>["emulator"], col: string) =>
  emulator.state.tables.get("Table1")!.rows.map((r) => (r as Record<string, unknown>)[col])
const updates = (emulator: ReturnType<typeof setup>["emulator"]) => actionsOf(emulator).filter((a) => String(a[0]).includes("Update"))

describe("Bulk editor", () => {
  it("AC-1 types the new value's field by the column", async () => {
    setup("Status")
    const select = await screen.findByLabelText("New value for Status")
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["(blank)", "To do", "Doing", "Done"])
    cleanup()
    setup("Done")
    expect(await screen.findByRole("switch")).toBeInTheDocument()
    cleanup()
    setup("Due")
    expect(await screen.findByLabelText("New value for Due")).toHaveAttribute("type", "date")
  })

  it("AC-2 counts the rows the value would change, leaving out those that have it", async () => {
    setup("Status")
    fireEvent.change(await screen.findByLabelText("New value for Status"), { target: { value: "Done" } })
    expect(screen.getByRole("button", { name: "Set it on 2 rows…" })).toBeEnabled()
    expect(screen.getByText(/3 rows this section shows/)).toBeInTheDocument()
  })

  it("AC-3 asks to confirm, naming the column, the value and the count; Cancel changes nothing", async () => {
    const { emulator } = setup("Status")
    fireEvent.change(await screen.findByLabelText("New value for Status"), { target: { value: "Done" } })
    fireEvent.click(screen.getByRole("button", { name: "Set it on 2 rows…" }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Set Status to “Done” on 2 of the 3 rows?")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(updates(emulator)).toHaveLength(0)
  })

  it("AC-4 writes every row in one action, encoded for the column", async () => {
    const { emulator } = setup("Due")
    fireEvent.change(await screen.findByLabelText("New value for Due"), { target: { value: "2026-04-01" } })
    fireEvent.click(screen.getByRole("button", { name: "Set it on 3 rows…" }))
    fireEvent.click(screen.getByRole("button", { name: "Yes, set it" }))
    expect(await screen.findByText("3 rows updated.")).toBeInTheDocument()
    expect(cells(emulator, "Due")).toEqual([day(4, 1), day(4, 1), day(4, 1)])
    expect(updates(emulator)).toHaveLength(1)
  })

  it("AC-5 puts every previous value back with Undo, in one action", async () => {
    const { emulator } = setup("Status")
    fireEvent.change(await screen.findByLabelText("New value for Status"), { target: { value: "Done" } })
    fireEvent.click(screen.getByRole("button", { name: "Set it on 2 rows…" }))
    fireEvent.click(screen.getByRole("button", { name: "Yes, set it" }))
    await screen.findByText("2 rows updated.")
    expect(cells(emulator, "Status")).toEqual(["Done", "Done", "Done"])
    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    await waitFor(() => expect(cells(emulator, "Status")).toEqual(["To do", "Doing", "Done"]))
    expect(updates(emulator)).toHaveLength(2)
  })

  it("AC-6 says when a number field holds no number, and can't apply it", async () => {
    setup("Hours")
    fireEvent.change(await screen.findByLabelText("New value for Hours"), { target: { value: "lots" } })
    expect(screen.getByText("Enter a number.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Set it on|Every row/ })).toBeDisabled()
  })

  it("AC-7 says a formula column can't be set", async () => {
    setup("Total")
    expect(await screen.findByText("Total is calculated by a formula: it can't be set.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Set it on/ })).not.toBeInTheDocument()
  })

  it("AC-8 shows the error when Grist refuses the change", async () => {
    // A column the table doesn't have: Grist, and the emulator, refuse the write ("Invalid column").
    const { emulator } = setup("Ghost")
    fireEvent.change(await screen.findByLabelText("New value for Ghost"), { target: { value: "boo" } })
    fireEvent.click(screen.getByRole("button", { name: "Set it on 3 rows…" }))
    fireEvent.click(screen.getByRole("button", { name: "Yes, set it" }))
    expect(await screen.findByText(/Grist did not apply the change/)).toBeInTheDocument()
    expect(cells(emulator, "Title")).toEqual(["Plan", "Build", "Ship"])
  })

  it("AC-9 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup("Status")
    expect(await screen.findByLabelText("Nouvelle valeur de Status")).toBeInTheDocument()
  })

  it("AC-10 says when every row has the value already, and writes nothing", async () => {
    const { emulator } = setup("Status", ROWS.map((r) => ({ ...r, Status: "Done" })))
    fireEvent.change(await screen.findByLabelText("New value for Status"), { target: { value: "Done" } })
    expect(screen.getByRole("button", { name: "Every row has this value already" })).toBeDisabled()
    expect(updates(emulator)).toHaveLength(0)
  })
})
