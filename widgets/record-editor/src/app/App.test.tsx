import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { actionsOf, cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument } from "grist-widget-sdk"

import App, { widget } from "./App"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const FIELDS = ["Title", "Status", "Tags", "Done", "Hours", "Visits", "Due", "Start", "Tech", "Total", "Notes"]
const day = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000

const document = (): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Interventions",
  mode: "schema+data",
  tables: {
    Interventions: {
      columns: {
        Title: { type: "Text", label: "Title", colRef: 1 },
        Status: { type: "Choice", label: "Status", colRef: 2, widgetOptions: { choices: ["Open", "Done"] } },
        Tags: { type: "ChoiceList", label: "Tags", colRef: 3, widgetOptions: { choices: ["urgent", "client"] } },
        Done: { type: "Bool", label: "Done", colRef: 4 },
        Hours: { type: "Numeric", label: "Hours", colRef: 5 },
        Visits: { type: "Int", label: "Visits", colRef: 6 },
        Due: { type: "Date", label: "Due", colRef: 7 },
        Start: { type: "DateTime:Europe/Paris", label: "Start", colRef: 8 },
        Tech: { type: "Ref:Technicians", label: "Technician", colRef: 9, visibleColRef: 20 },
        Total: { type: "Numeric", label: "Total", colRef: 10, isFormula: true, formula: "$Hours * 2" },
        Notes: { type: "Text", label: "Notes", colRef: 11, widgetOptions: { wrap: true } },
      },
      rows: [
        {
          id: 1,
          Title: "Fix the boiler",
          Status: "Open",
          Tags: ["L", "urgent"],
          Done: false,
          Hours: 3,
          Visits: 1,
          Due: day(2026, 3, 2),
          // 12:30 UTC on the day Paris moves to summer time: 14:30 in Paris.
          Start: Date.UTC(2026, 2, 29, 12, 30) / 1000,
          Tech: 2,
          Total: 6,
          Notes: "Bring the <b>spare</b> valve",
        },
        { id: 2, Title: "Paint the hall", Status: "Done", Tags: null, Done: true, Hours: 8, Visits: 2, Due: null, Start: null, Tech: 0, Total: 16, Notes: "" },
      ],
    },
    Technicians: {
      columns: { Name: { type: "Text", label: "Name", colRef: 20 } },
      rows: [
        { id: 1, Name: "Léa" },
        { id: 2, Name: "Marc" },
      ],
    },
  },
})

function setup(fields: string[] = FIELDS) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: document(), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings({ Fields: fields })
  result.emulator.selectRow(1)
  return result
}

const row = (emulator: ReturnType<typeof setup>["emulator"], id: number) =>
  emulator.state.tables.get("Interventions")!.rows.find((r) => r.id === id) as Record<string, unknown> | undefined
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }))
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe("Record editor", () => {
  it("AC-1 shows a field per mapped column, in order, labelled, with the row's values", async () => {
    const { container } = setup()
    expect(await screen.findByLabelText("Title")).toHaveValue("Fix the boiler")
    const labels = [...container.querySelectorAll("label, span[id$='-label']")].map((l) => l.textContent)
    expect(labels).toEqual(["Title", "Status", "Tags", "Done", "Hours", "Visits", "Due", "Start", "Technician", "Total", "Notes"])
    expect(screen.getByLabelText("Hours")).toHaveValue("3")
    expect(screen.getByLabelText("Notes")).toHaveValue("Bring the <b>spare</b> valve")
  })

  it("AC-2 types each field by its column: choices, toggles, a switch, a date, the referenced rows", async () => {
    setup()
    const status = await screen.findByLabelText("Status")
    expect(within(status).getAllByRole("option").map((o) => o.textContent)).toEqual(["—", "Open", "Done"])
    expect(status).toHaveValue("Open")
    const tags = screen.getByRole("group", { name: "Tags" })
    expect(within(tags).getByRole("button", { name: "urgent" })).toHaveAttribute("aria-pressed", "true")
    expect(within(tags).getByRole("button", { name: "client" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("switch", { name: "Done" })).not.toBeChecked()
    expect(screen.getByLabelText("Due")).toHaveAttribute("type", "date")
    expect(screen.getByLabelText("Due")).toHaveValue("2026-03-02")
    const tech = screen.getByLabelText("Technician")
    await waitFor(() => expect(within(tech).getAllByRole("option").map((o) => o.textContent)).toEqual(["—", "Léa", "Marc"]))
    expect(tech).toHaveValue("2")
  })

  it("AC-2 reads a list whose first choice is \"E\" as its choices, not a formula error (#135)", async () => {
    const { emulator } = setup()
    // A choice "E", then "urgent", as Grist stores them: the tag, then the choices.
    emulator.mutate.updateRow("Interventions", 1, { Tags: ["L", "E", "urgent"] })
    await waitFor(() =>
      expect(within(screen.getByRole("group", { name: "Tags" })).getByRole("button", { name: "urgent" })).toHaveAttribute("aria-pressed", "true")
    )
  })

  it("AC-3 shows a formula column's value without letting it be edited", async () => {
    setup()
    const total = await screen.findByLabelText("Total")
    expect(total).toHaveValue("6")
    expect(total).toHaveAttribute("readonly")
  })

  it("AC-4 saves only the changed fields, encoded, in one action", async () => {
    const { emulator } = setup()
    await screen.findByLabelText("Title")
    type("Title", "Fix the boiler today")
    type("Due", "2026-04-01")
    fireEvent.click(within(screen.getByRole("group", { name: "Tags" })).getByRole("button", { name: "client" }))
    fireEvent.click(screen.getByRole("switch", { name: "Done" }))
    await waitFor(() => expect(screen.getByLabelText("Technician")).toHaveDisplayValue("Marc"))
    type("Technician", "1")
    const before = actionsOf(emulator).length
    save()
    await waitFor(() => expect(row(emulator, 1)?.Title).toBe("Fix the boiler today"))
    const written = actionsOf(emulator).slice(before)
    expect(written).toHaveLength(1)
    const fields = written[0]!.at(-1) as Record<string, unknown>
    expect(Object.keys(fields).sort()).toEqual(["Done", "Due", "Tags", "Tech", "Title"])
    expect(row(emulator, 1)).toMatchObject({ Due: day(2026, 4, 1), Tags: ["L", "urgent", "client"], Done: true, Tech: 1, Status: "Open" })
  })

  it("AC-5 puts the row's values back on Cancel", async () => {
    setup()
    await screen.findByLabelText("Title")
    type("Title", "Something else")
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByLabelText("Title")).toHaveValue("Fix the boiler")
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("AC-6 says when a number field holds no number, or no whole number, and disables Save", async () => {
    setup()
    await screen.findByLabelText("Hours")
    type("Hours", "three")
    expect(screen.getByText("Enter a number.")).toBeInTheDocument()
    expect(screen.getByLabelText("Hours")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    type("Hours", "3,5")
    type("Visits", "1.5")
    expect(screen.queryByText("Enter a number.")).not.toBeInTheDocument()
    expect(screen.getByText("Enter a whole number.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("AC-7 keeps a row's unsaved edits when another row is selected and back", async () => {
    const { emulator } = setup()
    await screen.findByLabelText("Title")
    type("Title", "Half-typed")
    emulator.selectRow(2)
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Paint the hall"))
    expect(screen.queryByText("Not saved")).not.toBeInTheDocument()
    emulator.selectRow(1)
    await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Half-typed"))
    expect(screen.getByText("Not saved")).toBeInTheDocument()
  })

  it("AC-8 adds a row from an empty form, and selects it", async () => {
    const { emulator } = setup()
    await screen.findByLabelText("Title")
    fireEvent.click(screen.getByRole("button", { name: "New" }))
    expect(screen.getByRole("heading", { name: "New row" })).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveValue("")
    type("Title", "Check the roof")
    type("Status", "Open")
    save()
    await waitFor(() => expect(emulator.state.tables.get("Interventions")!.rows).toHaveLength(3))
    const added = emulator.state.tables.get("Interventions")!.rows.at(-1) as Record<string, unknown>
    expect(added).toMatchObject({ Title: "Check the roof", Status: "Open" })
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(added.id))
  })

  it("AC-9 shows Grist's error and keeps the edits when a save fails", async () => {
    // The mapped column is removed by someone else, and the save goes out before Grist says so:
    // Grist, and the emulator, refuse the write ("Invalid column").
    const withGhost = document()
    const table = withGhost.tables.Interventions!
    table.columns = { ...table.columns, Ghost: { type: "Text", label: "Ghost" } }
    const { emulator } = renderWithGrist(<App />, { widget, emulator: { document: withGhost, widgetInteraction: { access_level: "full" } } })
    emulator.setColumnMappings({ Fields: ["Title", "Ghost"] })
    emulator.selectRow(1)
    await screen.findByLabelText("Ghost")
    type("Ghost", "boo")
    delete emulator.state.tables.get("Interventions")!.columns.Ghost
    save()
    expect(await screen.findByText(/Grist did not save the row/)).toBeInTheDocument()
    expect(screen.getByLabelText("Ghost")).toHaveValue("boo")
    expect(screen.getByText("Not saved")).toBeInTheDocument()
  })

  it("AC-10 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByRole("button", { name: "Enregistrer" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Ligne 1" })).toBeInTheDocument()
  })

  it("AC-11 shows and writes a DateTime in the column's time zone", async () => {
    const { emulator } = setup()
    expect(await screen.findByLabelText("Start")).toHaveValue("2026-03-29T14:30")
    type("Start", "2026-10-25T09:00")
    save()
    // 25 October 2026, the day Paris goes back to winter time: 09:00 there is 08:00 UTC.
    await waitFor(() => expect(row(emulator, 1)?.Start).toBe(Date.UTC(2026, 9, 25, 8, 0) / 1000))
  })

  it("AC-12 says when no row is selected, and offers New", async () => {
    const { emulator } = setup()
    await screen.findByLabelText("Title")
    emulator.selectRow(null)
    expect(await screen.findByText(/No row is selected/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "New" }))
    expect(screen.getByRole("heading", { name: "New row" })).toBeInTheDocument()
  })
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
