import "@testing-library/jest-dom/vitest"
import { act } from "react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument } from "grist-widget-sdk"

import App, { widget } from "./App"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const DOC: GristReplicaDocument = {
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "CRM",
  mode: "schema+data",
  selection: { tableId: "Contacts" },
  tables: {
    Companies: { columns: { Name: { type: "Text", label: "Name", parentPos: 1 } }, rows: [{ id: 1, Name: "Acme" }] },
    Contacts: {
      columns: {
        Name: { type: "Text", label: "Name", parentPos: 2 },
        Company: { type: "Ref:Companies", label: "Company", parentPos: 3 },
        Tags: { type: "RefList:Tags", label: "Tags", parentPos: 4 },
        Manager: { type: "Ref:Contacts", label: "Manager", parentPos: 5 },
        Initials: { type: "Text", label: "Initials", isFormula: true, formula: "$Name[:2]", parentPos: 6 },
      },
      rows: [{ id: 1, Name: "Ana", Company: 1, Tags: null, Manager: 0 }],
    },
    Tags: { columns: { Tag: { type: "Text", label: "Tag", parentPos: 7 } }, rows: [] },
    Notes: { columns: { Body: { type: "Text", label: "Body", parentPos: 8 } }, rows: [] },
  },
}

function setup(doc: GristReplicaDocument = DOC) {
  return renderWithGrist(<App />, { widget, emulator: { document: doc, widgetInteraction: { access_level: "full" } } })
}

const svg = () => screen.findByRole("img", { name: "Entity-relationship diagram of the document" })
const tables = (root: Element) => [...root.querySelectorAll("[data-table]")].map((g) => g.getAttribute("data-table"))
const columns = (root: Element, table: string) => [...root.querySelectorAll(`[data-table="${table}"] [data-column]`)].map((g) => g.textContent)
async function asText() {
  fireEvent.mouseDown(screen.getByRole("tab", { name: "As text" }))
  fireEvent.click(screen.getByRole("tab", { name: "As text" }))
  return (await screen.findByRole("textbox", { name: "As text" })) as HTMLTextAreaElement
}

describe("Schema viewer", () => {
  it("AC-1 draws each table with its columns and their types", async () => {
    setup()
    const root = await svg()
    expect(tables(root)).toEqual(["Companies", "Contacts", "Tags", "Notes"])
    expect(columns(root, "Contacts")).toEqual(["NameText", "CompanyRef:Companies", "TagsRefList:Tags", "ManagerRef:Contacts", "Initialsformula: $Name[:2]ƒ Text"])
    expect(root.textContent).not.toContain("manualSort")
    expect(screen.getByText("4 tables, 3 references.")).toBeInTheDocument()
  })

  it("AC-2 draws an arrow per reference, a RefList's dashed and marked as a list", async () => {
    setup()
    const root = await svg()
    const links = [...root.querySelectorAll("[data-link]")]
    expect(links.map((l) => l.getAttribute("data-link"))).toEqual(["Contacts.Company->Companies", "Contacts.Tags->Tags", "Contacts.Manager->Contacts"])
    const list = links[1]!
    expect(list).toHaveAttribute("data-many", "true")
    expect(list.querySelector("polyline")).toHaveAttribute("stroke-dasharray")
    expect(list).toHaveTextContent("Tags (list)")
    expect(links[0]!.querySelector("polyline")).not.toHaveAttribute("stroke-dasharray")
    for (const l of links) expect(l.querySelector("polyline")!.getAttribute("points")).toMatch(/\d/)
  })

  it("AC-3 marks a formula column, with its formula on hover", async () => {
    setup()
    const root = await svg()
    const col = root.querySelector('[data-table="Contacts"] [data-column="Initials"]')!
    expect(col).toHaveTextContent("ƒ Text")
    expect(col.querySelector("title")).toHaveTextContent("formula: $Name[:2]")
  })

  it("AC-4 narrows the diagram to a table and its neighbours", async () => {
    setup()
    await svg()
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "Tags" } })
    expect(tables(await svg())).toEqual(["Contacts", "Tags"])
    expect(screen.getByText("2 tables, 2 references.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "Notes" } })
    await waitFor(async () => expect(tables(await svg())).toEqual(["Notes"]))
  })

  it("AC-5 gives the schema in Markdown", async () => {
    setup()
    await svg()
    const box = await asText()
    expect(box.value).toContain("## Contacts\n\n- `Name`: Text\n- `Company`: Ref:Companies, a reference to a row of Companies\n- `Tags`: RefList:Tags, references to rows of Tags")
    expect(box.value).toContain("- `Initials`: Text, formula: `$Name[:2]`")
  })

  it("AC-6 gives the schema as a Mermaid entity-relationship diagram", async () => {
    setup()
    await svg()
    await asText()
    fireEvent.change(screen.getByLabelText("Format"), { target: { value: "mermaid" } })
    const value = (screen.getByRole("textbox", { name: "As text" }) as HTMLTextAreaElement).value
    expect(value.split("\n")[0]).toBe("erDiagram")
    expect(value).toContain("  Contacts {\n    Text Name\n    Ref_Companies Company")
    expect(value).toContain('    Text Initials "formula"')
    expect(value).toContain('  Contacts }o--o| Companies : "Company"')
    expect(value).toContain('  Contacts }o--o{ Tags : "Tags"')
  })

  it("AC-7 reads the document again on Read again", async () => {
    const { emulator } = setup()
    await svg()
    emulator.state.tables.get("Notes")!.columns.Author = { type: "Text", label: "Author", parentPos: 9 } as never
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Read again" })))
    await waitFor(async () => expect(columns(await svg(), "Notes")).toEqual(["BodyText", "AuthorText"]))
  })

  it("AC-8 says to copy by hand when the browser refuses", async () => {
    setup()
    await svg()
    await asText()
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) }, configurable: true })
    fireEvent.click(screen.getByRole("button", { name: "Copy" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Copying isn't allowed here: select the text and copy it.")
  })

  it("AC-9 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByRole("button", { name: "Relire" })).toBeInTheDocument()
  })
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
