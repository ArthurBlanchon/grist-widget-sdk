import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { actionsOf, cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"
import { findGroups } from "./match"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const PEOPLE: GristReplicaRow[] = [
  { id: 1, Name: "Zoé Martin", Email: "zoe@example.org", City: "", Manager: 0, Score: 3, Initial: "Z" },
  { id: 2, Name: "zoe  martin.", Email: "", City: "Lyon", Manager: 0, Score: 4, Initial: "z" },
  { id: 3, Name: "Ana Lopez", Email: "ana@example.org", City: "Lille", Manager: 2, Score: 1, Initial: "A" },
  { id: 4, Name: "", Email: "", City: "Nantes", Manager: 0, Score: 2, Initial: "" },
  { id: 5, Name: "", Email: "", City: "Brest", Manager: 0, Score: 2, Initial: "" },
  { id: 6, Name: "Ana Lopes", Email: "", City: "", Manager: 0, Score: 1, Initial: "A" },
]

const doc = (people = PEOPLE, orders?: GristReplicaRow[]): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Contacts",
  mode: "schema+data",
  selection: { tableId: "People" },
  tables: {
    People: {
      columns: {
        Name: { type: "Text", label: "Name" },
        Email: { type: "Text", label: "Email" },
        City: { type: "Text", label: "City" },
        Manager: { type: "Ref:People", label: "Manager" },
        Score: { type: "Numeric", label: "Score" },
        Initial: { type: "Text", label: "Initial", isFormula: true, formula: "$Name[:1]" },
      },
      rows: people,
    },
    Orders: {
      columns: {
        Buyer: { type: "Ref:People", label: "Buyer" },
        Team: { type: "RefList:People", label: "Team" },
      },
      rows: orders ?? [
        { id: 1, Buyer: 2, Team: ["L", 1, 2] },
        { id: 2, Buyer: 3, Team: ["L", 2, 3] },
        { id: 3, Buyer: 1, Team: null },
      ],
    },
  },
})

function setup(keys: string[] = ["Name"], people?: GristReplicaRow[], orders?: GristReplicaRow[]) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(people, orders), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings({ Keys: keys })
  return result
}

const table = (emulator: ReturnType<typeof setup>["emulator"], id: string) => emulator.state.tables.get(id)!.rows as Record<string, unknown>[]
const groupOf = (n: number) => screen.getByRole("group", { name: `Group ${n}` }).closest("li") as HTMLElement

describe("Duplicate finder", () => {
  it("AC-1 groups rows equal once case, accents, spaces and punctuation are set aside; blank keys never", async () => {
    setup()
    expect(await screen.findByText("1 groups of duplicates among the 6 rows this section shows.")).toBeInTheDocument()
    const rows = within(groupOf(1)).getAllByRole("radio")
    expect(rows.map((r) => r.getAttribute("aria-label"))).toEqual(["Keep Row 1", "Keep Row 2"])
  })

  it("AC-2 groups keys that differ by a typo in approximate mode", async () => {
    setup()
    await screen.findByText(/1 groups/)
    fireEvent.change(screen.getByLabelText("Matching"), { target: { value: "close" } })
    expect(await screen.findByText(/2 groups/)).toBeInTheDocument()
    expect(within(groupOf(2)).getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual(["Keep Row 3", "Keep Row 6"])
    // A typo at the start is found too, through the reversed key.
    const rows = [
      { id: 1, Name: "Kristina Olsen" },
      { id: 2, Name: "Cristina Olsen" },
      { id: 3, Name: "Someone Else" },
    ]
    expect(findGroups(rows, ["Name"], "close").map((g) => g.map((r) => r.id))).toEqual([[1, 2]])
    expect(findGroups(rows, ["Name"], "exact")).toEqual([])
  })

  it("AC-3 keeps the row with the most filled cells, and another can be chosen", async () => {
    setup()
    await screen.findByText(/1 groups/)
    // Row 1 and row 2 fill as many cells; row 3 of the close group has more than row 6.
    fireEvent.change(screen.getByLabelText("Matching"), { target: { value: "close" } })
    await screen.findByText(/2 groups/)
    expect(within(groupOf(2)).getByRole("radio", { name: "Keep Row 3" })).toBeChecked()
    fireEvent.click(within(groupOf(2)).getByRole("radio", { name: "Keep Row 6" }))
    expect(within(groupOf(2)).getByRole("radio", { name: "Keep Row 6" })).toBeChecked()
    cleanup()

    // The cells that count are the whole row's, not only the keys Grist sends a mapped widget.
    setup(["Name"], [
      { id: 1, Name: "Ana", Email: "", City: "", Manager: 0, Score: null, Initial: "A" },
      { id: 2, Name: "Ana", Email: "ana@example.org", City: "Lyon", Manager: 0, Score: 2, Initial: "A" },
    ])
    await screen.findByText(/1 groups/)
    await waitFor(() => expect(within(groupOf(1)).getByRole("radio", { name: "Keep Row 2" })).toBeChecked())
  })

  it("AC-4 says what a merge does before making it; Cancel changes nothing", async () => {
    const { emulator } = setup()
    await screen.findByText(/1 groups/)
    fireEvent.click(within(groupOf(1)).getByRole("button", { name: "Merge…" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(dialog).toHaveTextContent("Keep row 1 and delete row 2?")
    expect(dialog).toHaveTextContent("1 blank cells of row 1 are filled from them.")
    expect(dialog).toHaveTextContent("1 references in People move to row 1.")
    expect(dialog).toHaveTextContent("3 references in Orders move to row 1.")
    const before = actionsOf(emulator).length
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(actionsOf(emulator).length).toBe(before)
    expect(table(emulator, "People")).toHaveLength(6)
  })

  it("AC-5 deletes the others and fills the kept row's blank cells, formulas aside, in one action", async () => {
    const { emulator } = setup()
    await screen.findByText(/1 groups/)
    fireEvent.click(within(groupOf(1)).getByRole("button", { name: "Merge…" }))
    const before = actionsOf(emulator).length
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Yes, merge" }))
    expect(await screen.findByText("Merged: 1 rows deleted. Grist's Undo puts them back.")).toBeInTheDocument()
    const people = table(emulator, "People")
    expect(people.map((r) => r.id)).toEqual([1, 3, 4, 5, 6])
    expect(people[0]).toMatchObject({ Name: "Zoé Martin", Email: "zoe@example.org", City: "Lyon", Initial: "Z" })
    // One applyActions call: the fill, the moved references and the removal together.
    const sent = actionsOf(emulator).slice(before)
    expect(sent.map((a) => a[0])).toEqual(["BulkUpdateRecord", "BulkUpdateRecord", "BulkUpdateRecord", "BulkUpdateRecord", "BulkRemoveRecord"])
    expect(sent[0]).toEqual(["BulkUpdateRecord", "People", [1], { City: ["Lyon"] }])
  })

  it("AC-6 points references to a deleted row, Ref and RefList, in any table, at the kept row", async () => {
    const { emulator } = setup()
    await screen.findByText(/1 groups/)
    fireEvent.click(within(groupOf(1)).getByRole("button", { name: "Merge…" }))
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Yes, merge" }))
    await screen.findByText(/Merged/)
    expect(table(emulator, "People").find((r) => r.id === 3)!.Manager).toBe(1)
    const orders = table(emulator, "Orders")
    expect(orders.map((r) => r.Buyer)).toEqual([1, 3, 1])
    const team = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x !== "L") : v)
    expect(orders.map((r) => team(r.Team))).toEqual([[1], [1, 3], null])
  })

  it("AC-7 reports each column's blank cells, wrong-typed cells and formula errors", async () => {
    const people = PEOPLE.map((r) => (r.id === 4 ? { ...r, Score: "n/a" } : r.id === 5 ? { ...r, Initial: ["E", "IndexError"] } : r))
    setup(["Name"], people)
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Column report" }))
    fireEvent.click(screen.getByRole("tab", { name: "Column report" }))
    const row = async (col: string) => within((await screen.findByRole("table")).querySelector(`[data-col="${col}"]`) as HTMLElement).getAllByRole("cell").map((c) => c.textContent)
    expect(await row("Email")).toEqual(["4", "0", "0", "—"])
    expect(await row("Score")).toEqual(["0", "1", "0", "—"])
    expect(await row("Initial")).toEqual(["1", "0", "1", "—"])
  })

  it("AC-8 counts references to rows that don't exist", async () => {
    setup(["Name"], PEOPLE.map((r) => (r.id === 6 ? { ...r, Manager: 42 } : r)))
    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Column report" }))
    fireEvent.click(screen.getByRole("tab", { name: "Column report" }))
    const table = await screen.findByRole("table")
    await waitFor(() => expect(within(table.querySelector('[data-col="Manager"]') as HTMLElement).getAllByRole("cell").map((c) => c.textContent)).toEqual(["4", "0", "0", "1"]))
  })

  it("AC-9 shows the error when Grist refuses the merge", async () => {
    const { emulator } = setup()
    await screen.findByText(/1 groups/)
    vi.spyOn(emulator.grist!.docApi, "applyUserActions").mockRejectedValue(new Error("Access denied"))
    fireEvent.click(within(groupOf(1)).getByRole("button", { name: "Merge…" }))
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Yes, merge" }))
    expect(await screen.findByText("Grist did not apply the merge: Access denied")).toBeInTheDocument()
    expect(table(emulator, "People")).toHaveLength(6)
  })

  it("AC-10 says when there are no duplicates", async () => {
    setup(["Email"])
    expect(await screen.findByText("No duplicates among the 6 rows this section shows.")).toBeInTheDocument()
  })

  it("AC-11 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByRole("button", { name: "Fusionner…" })).toBeInTheDocument()
  })
})
