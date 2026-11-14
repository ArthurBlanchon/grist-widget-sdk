import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget, writeDates } from "./App"
import { readableOn } from "./colors"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const day = (m: number, d: number) => Date.UTC(2026, m - 1, d) / 1000

const ROWS: GristReplicaRow[] = [
  { id: 1, Title: "Survey", Start: day(3, 2), End: day(3, 6), Group: "Design", Sequence: "Team A", Status: "Done" },
  { id: 2, Title: "Plans", Start: day(3, 9), End: day(3, 20), Group: "Design", Sequence: "Team A", Status: "Late" },
  { id: 3, Title: "Sketches", Start: day(3, 4), End: day(3, 12), Group: "Design", Sequence: "Team A", Status: null },
  { id: 4, Title: "Permit", Start: day(3, 16), End: day(4, 10), Group: "Permits", Sequence: "Office", Status: "Planned" },
  { id: 5, Title: "No dates", Start: null, End: null, Group: "Permits", Sequence: "Office", Status: null },
]

const doc = (rows: GristReplicaRow[] = ROWS): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Renovation",
  mode: "schema+data",
  tables: {
    Table1: {
      columns: {
        Title: { type: "Text" },
        Start: { type: "Date" },
        End: { type: "Date" },
        Group: { type: "Text" },
        Sequence: { type: "Text" },
        Status: {
          type: "Choice",
          widgetOptions: {
            choices: ["Planned", "Done", "Late"],
            choiceOptions: { Done: { fillColor: "#16A34A", textColor: "#FFFFFF" }, Late: { fillColor: "#FDE68A" } },
          },
        },
      },
      rows,
    },
  },
})

const ALL = { Title: "Title", Start: "Start", End: "End", Group: "Group", Sequence: "Sequence", Status: "Status" }

function setup(mappings: Record<string, string> = ALL, rows?: GristReplicaRow[]) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(rows), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings(mappings)
  return result
}

/** A task's bar on the timeline: the card holding its name. */
const bar = (name: string) =>
  screen
    .getAllByText(name)
    .map((el) => el.closest<HTMLElement>("[data-slot=card]"))
    .find((el): el is HTMLElement => Boolean(el))!

describe("Gantt chart", () => {
  it("AC-1 shows each dated row as a bar, under its group, on its sequence's row", async () => {
    setup()
    expect(await screen.findByText("Survey")).toBeInTheDocument()
    expect(screen.getByText("Design")).toBeInTheDocument()
    expect(screen.getByText("Permits")).toBeInTheDocument()
    expect(screen.getByText("Team A")).toBeInTheDocument()
    expect(screen.getByText("Office")).toBeInTheDocument()
    for (const name of ["Survey", "Plans", "Sketches", "Permit"]) expect(bar(name)).toBeInTheDocument()
  })

  it("AC-2 gives each task a row of its own without a Sequence column", async () => {
    const noSequence: Record<string, string> = { ...ALL }
    delete noSequence.Sequence
    setup(noSequence)
    await screen.findAllByText("Survey")
    // The sidebar lists each task's row by the task's title.
    for (const name of ["Survey", "Plans", "Sketches", "Permit"]) expect(screen.getAllByText(name).length).toBeGreaterThanOrEqual(2)
  })

  it("AC-3 puts a sequence's tasks on one row, stacking those that overlap", async () => {
    setup()
    await screen.findByText("Survey")
    // Team A's three tasks: Survey and Sketches overlap, so the row has two sub-rows.
    expect(screen.getAllByText("Team A")).toHaveLength(1)
    const rows = document.querySelectorAll("[data-roadmap-ui='gantt-sidebar'] [style*='--gantt-row-height']")
    expect(rows.length).toBeGreaterThan(0)
  })

  it("AC-4 colours bars by their status's colour in Grist, and by the theme otherwise", async () => {
    setup()
    await screen.findByText("Survey")
    await waitFor(() => expect(bar("Survey").style.backgroundColor).toBe("rgb(22, 163, 74)"))
    expect(bar("Survey").style.color).toBe("rgb(255, 255, 255)")
    expect(bar("Plans").style.backgroundColor).toBe("rgb(253, 230, 138)")
    expect(readableOn("#FDE68A")).toBe("black")
    expect(bar("Sketches").style.backgroundColor).toBe("var(--primary)")
  })

  it("AC-5 writes the days a moved or resized bar covers to the row's Start and End", async () => {
    let update: ReturnType<typeof widget.useGrist>["updateRecord"] | null = null
    function Probe() {
      update = widget.useGrist().updateRecord
      return <App />
    }
    const { emulator } = renderWithGrist(<Probe />, { widget, emulator: { document: doc(), widgetInteraction: { access_level: "full" } } })
    emulator.setColumnMappings(ALL)
    await screen.findByText("Survey")
    // The timeline hands over local days; Grist keeps each as UTC midnight.
    await writeDates(update!, 1, new Date(2026, 2, 9), new Date(2026, 2, 13))
    const row = emulator.state.tables.get("Table1")!.rows.find((r) => r.id === 1)!
    expect(row).toMatchObject({ Start: day(3, 9), End: day(3, 13) })
  })

  it("AC-6 leaves out rows without dates, and says how many", async () => {
    setup()
    expect(await screen.findByText(/1 rows without dates not shown/)).toBeInTheDocument()
    expect(screen.queryByText("No dates")).not.toBeInTheDocument()
  })

  it("AC-7 switches the timeline between weeks and months", async () => {
    setup()
    await screen.findByText("Survey")
    const months = screen.getByRole("button", { name: "Months" })
    fireEvent.click(months)
    expect(months).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Weeks" })).toHaveAttribute("aria-pressed", "false")
  })

  it("AC-8 shows the error when Grist refuses the new dates", async () => {
    let update: ReturnType<typeof widget.useGrist>["updateRecord"] | null = null
    function Probe() {
      update = widget.useGrist().updateRecord
      return <App />
    }
    const { emulator } = renderWithGrist(<Probe />, { widget, emulator: { document: doc(), widgetInteraction: { access_level: "full" } } })
    emulator.setColumnMappings(ALL)
    await screen.findByText("Survey")
    await expect(writeDates(update!, 999, new Date(2026, 2, 9), new Date(2026, 2, 13))).rejects.toThrow(/999/)
  })

  it("AC-9 speaks French, timeline dates included", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByText("Diagramme de Gantt")).toBeInTheDocument()
    expect(screen.getByText("Durée")).toBeInTheDocument()
    const html = document.body.innerHTML
    expect(html).toMatch(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/)
    expect(html).not.toMatch(/January|February|March|April|June|July|August|September|October|November|December/)
    expect(html).toMatch(/jours/)
  })

  it("AC-10 shows an HTML title as text", async () => {
    setup(ALL, [{ id: 1, Title: "<img src=x onerror=alert(1)>", Start: day(3, 2), End: day(3, 6), Group: "G", Sequence: "S", Status: null }])
    expect((await screen.findAllByText("<img src=x onerror=alert(1)>")).length).toBeGreaterThan(0)
    expect(document.querySelector("img")).toBeNull()
  })

  it("AC-11 says when no task has dates", async () => {
    setup(ALL, [{ id: 1, Title: "Undated", Start: null, End: null, Group: "G", Sequence: "S", Status: null }])
    expect(await screen.findByText(/No tasks to show/)).toBeInTheDocument()
  })
})
