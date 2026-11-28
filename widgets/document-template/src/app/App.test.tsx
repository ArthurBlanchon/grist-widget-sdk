import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ROWS: GristReplicaRow[] = [
  { id: 1, Client: "Acme", Amount: 1234.5, Issued: Date.UTC(2026, 2, 2) / 1000, Items: ["L", "Paint", "Labour"], Note: "<b>urgent</b>" },
  { id: 2, Client: "Brindille", Amount: 80, Issued: null, Items: null, Note: "" },
]

const doc = (options: Record<string, unknown> = {}): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Quotes",
  mode: "schema+data",
  widgetOptions: options,
  tables: {
    Quotes: {
      columns: {
        Client: { type: "Text" },
        Amount: { type: "Numeric" },
        Issued: { type: "Date" },
        Items: { type: "ChoiceList" },
        Note: { type: "Text" },
      },
      rows: ROWS,
    },
  },
})

function setup(template?: string, selected: number | null = 1) {
  const result = renderWithGrist(<App />, {
    widget,
    emulator: { document: doc(template === undefined ? {} : { template }), widgetInteraction: { access_level: "full" } },
  })
  result.emulator.selectRow(selected)
  return result
}

const frame = () => screen.getByTitle("The document") as HTMLIFrameElement
const shown = async (text: string) => waitFor(() => expect(frame().getAttribute("srcdoc")).toContain(text))

describe("Document template", () => {
  it("AC-1 fills each placeholder with the row's cell, numbers, dates and lists as text", async () => {
    setup("<p>{{Client}} owes {{Amount}} since {{Issued}} for {{Items}}.</p>")
    await shown("<p>Acme owes 1,234.5 since 3/2/2026 for Paint, Labour.</p>")
  })

  it("AC-1 keeps a list's first choice \"L\" (#133)", async () => {
    const { emulator } = setup("<p>{{Items}}</p>")
    // Sizes L and XL, as Grist stores them: the tag, then the choices.
    emulator.mutate.updateRow("Quotes", 1, { Items: ["L", "L", "XL"] })
    await shown("<p>L, XL</p>")
  })

  it("AC-1 keeps reading a list whose first choice is \"E\" as its choices (#135)", async () => {
    const { emulator } = setup("<p>{{Items}}</p>")
    // Grades E and M, as Grist stores them: the tag, then the choices.
    emulator.mutate.updateRow("Quotes", 1, { Items: ["L", "E", "M"] })
    await shown("<p>E, M</p>")
  })

  it("AC-2 writes a cell holding HTML as text", async () => {
    setup("<p>{{Note}}</p>")
    await shown("<p>&lt;b&gt;urgent&lt;/b&gt;</p>")
  })

  it("AC-3 shows the document where scripts don't run", async () => {
    setup("<script>parent.alert(1)</script><p>{{Client}}</p>")
    await shown("<p>Acme</p>")
    const sandbox = frame().getAttribute("sandbox") ?? ""
    expect(sandbox.split(" ")).not.toContain("allow-scripts")
    expect(frame().getAttribute("srcdoc")).toContain("default-src 'none'")
  })

  it("AC-4 leaves an unknown placeholder visible, and lists the columns in the editor", async () => {
    setup("<p>{{Cliant}}</p>")
    await shown("<mark title=\"unknown column\">{{Cliant}}</mark>")
    expect(screen.getByText("No column is called: Cliant")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit template" }))
    const listed = screen.getByText(/^Columns: /).textContent!.replace("Columns: ", "").split(", ")
    expect(listed.sort()).toEqual(["Amount", "Client", "Issued", "Items", "Note"])
  })

  it("AC-5 previews a changed template, and saves it in the widget's options", async () => {
    const { emulator } = setup("<p>{{Client}}</p>")
    await shown("<p>Acme</p>")
    fireEvent.click(screen.getByRole("button", { name: "Edit template" }))
    fireEvent.change(screen.getByLabelText("Template (HTML)"), { target: { value: "<h1>{{Client}}</h1>" } })
    await shown("<h1>Acme</h1>")
    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(emulator.state.widgetOptions).toMatchObject({ template: "<h1>{{Client}}</h1>" }))
    expect(screen.getByRole("button", { name: "Edit template" })).toBeInTheDocument()
  })

  it("AC-6 prints the document alone", async () => {
    setup("<p>{{Client}}</p>")
    await shown("<p>Acme</p>")
    const print = vi.fn()
    Object.defineProperty(frame().contentWindow!, "print", { value: print, configurable: true })
    fireEvent.click(screen.getByRole("button", { name: "Print" }))
    expect(print).toHaveBeenCalledOnce()
  })

  it("AC-7 repeats a {{#rows}} section for each row, in order", async () => {
    setup("<ul>{{#rows}}<li>{{Client}}: {{Amount}}</li>{{/rows}}</ul>", null)
    await shown("<ul><li>Acme: 1,234.5</li><li>Brindille: 80</li></ul>")
  })

  it("AC-8 starts from a template that shows every column as a table", async () => {
    setup()
    await shown("<tr><th>Client</th><td>Acme</td></tr>")
    expect(frame().getAttribute("srcdoc")).toContain("<tr><th>Amount</th><td>1,234.5</td></tr>")
  })

  it("AC-9 says when no row is selected and the template has no {{#rows}} section", async () => {
    setup("<p>{{Client}}</p>", null)
    expect(await screen.findByText(/No row is selected/)).toBeInTheDocument()
    expect(screen.queryByTitle("The document")).not.toBeInTheDocument()
  })

  it("AC-10 speaks French, and writes numbers the French way", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup("<p>{{Amount}}</p>")
    expect(await screen.findByRole("button", { name: "Imprimer" })).toBeInTheDocument()
    const doc = screen.getByTitle("Le document")
    await waitFor(() => expect(doc.getAttribute("srcdoc")).toMatch(/<p>1\s234,5<\/p>/))
  })
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
