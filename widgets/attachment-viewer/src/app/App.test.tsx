import "@testing-library/jest-dom/vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { GALLERY_MAX, widget } from "./App"

/** Each attachment's type, as Grist's download endpoint answers; a missing id fails. */
const TYPES: Record<number, string> = { 11: "image/jpeg", 12: "application/pdf", 13: "application/zip", 21: "image/png" }

beforeEach(() => {
  URL.createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type}:${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const id = Number(/\/attachments\/(\d+)\/download/.exec(String(input))?.[1])
    const type = TYPES[id]
    return type ? new Response("bytes", { headers: { "content-type": type } }) : new Response("gone", { status: 404 })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const doc = (rows: GristReplicaRow[], options: Record<string, unknown> = {}): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Site visits",
  mode: "schema+data",
  accessToken: { token: "tok", baseUrl: "https://grist.example/api/docs/doc1", ttlMsecs: 60_000 },
  widgetOptions: options,
  tables: {
    Table1: { columns: { Files: { type: "Attachments" }, Caption: { type: "Text" } }, rows },
    _grist_Attachments: {
      columns: { fileName: { type: "Text" } },
      rows: [
        { id: 11, fileName: "front.jpg" },
        { id: 12, fileName: "report.pdf" },
        { id: 13, fileName: "plans.zip" },
        { id: 14, fileName: "missing.jpg" },
        { id: 21, fileName: "<b>roof</b>.png" },
      ],
    },
  },
})

const ROWS: GristReplicaRow[] = [
  { id: 1, Files: ["L", 11, 12, 13], Caption: "Lyon" },
  { id: 2, Files: ["L", 21], Caption: "<i>Nantes</i>" },
  { id: 3, Files: null, Caption: "Paris" },
]

function setup(rows = ROWS, options?: Record<string, unknown>) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(rows, options), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings({ Files: "Files", Caption: "Caption" })
  result.emulator.selectRow(1)
  return result
}

const stage = () => screen.getByRole("region", { name: /^File / })

describe("Attachment viewer", () => {
  it("AC-1 shows the selected row's first file large, an image with its name as text alternative", async () => {
    setup()
    const img = await screen.findByRole("img", { name: "front.jpg" })
    expect(img.getAttribute("src")).toMatch(/^blob:image\/jpeg/)
    expect(screen.getByText("1 of 3: front.jpg")).toBeInTheDocument()
  })

  it("AC-2 shows a PDF in a frame, and offers another type of file as a download", async () => {
    setup()
    await screen.findByRole("img", { name: "front.jpg" })
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await within(stage()).findByTitle("report.pdf")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    const link = await screen.findByRole("link", { name: "Download plans.zip" })
    expect(link).toHaveAttribute("download", "plans.zip")
  })

  it("AC-3 moves through the files with the buttons and the arrow keys", async () => {
    setup()
    await screen.findByRole("img", { name: "front.jpg" })
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled()
    fireEvent.keyDown(stage(), { key: "ArrowRight" })
    expect(screen.getByText("2 of 3: report.pdf")).toBeInTheDocument()
    fireEvent.keyDown(stage(), { key: "ArrowRight" })
    fireEvent.keyDown(stage(), { key: "ArrowRight" })
    expect(screen.getByText("3 of 3: plans.zip")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Previous" }))
    expect(screen.getByText("2 of 3: report.pdf")).toBeInTheDocument()
  })

  it("AC-4 shows another row's files from the first", async () => {
    const { emulator } = setup()
    await screen.findByRole("img", { name: "front.jpg" })
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    emulator.selectRow(2)
    expect(await screen.findByText("1 of 1: <b>roof</b>.png")).toBeInTheDocument()
  })

  it("AC-5 shows every row's files in a gallery, the first 60, and how many in all", async () => {
    setup()
    await screen.findByRole("img", { name: "front.jpg" })
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }))
    expect(await screen.findByText("4 files")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(4)
    cleanup()
    const many = Array.from({ length: GALLERY_MAX + 5 }, (_, i) => ({ id: i + 1, Files: ["L", 11], Caption: `Row ${i}` }))
    setup(many, { mode: "gallery" })
    expect(await screen.findByText(`The first ${GALLERY_MAX} of ${GALLERY_MAX + 5} files`)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(GALLERY_MAX)
  })

  it("AC-6 selects a gallery file's row and shows that file in the viewer", async () => {
    const { emulator } = setup(ROWS, { mode: "gallery" })
    fireEvent.click(await screen.findByRole("button", { name: "Open report.pdf (Lyon)" }))
    await waitFor(() => expect(emulator.state.selection.rowId).toBe(1))
    expect(await screen.findByText("2 of 3: report.pdf")).toBeInTheDocument()
  })

  it("AC-7 saves the mode in the widget's options", async () => {
    const { emulator } = setup()
    await screen.findByRole("img", { name: "front.jpg" })
    fireEvent.click(screen.getByRole("button", { name: "Gallery" }))
    await waitFor(() => expect(emulator.state.widgetOptions).toMatchObject({ mode: "gallery" }))
    expect(screen.getByRole("button", { name: "Gallery" })).toHaveAttribute("aria-pressed", "true")
  })

  it("AC-8 says when a file can't be fetched, and still shows the others", async () => {
    setup([{ id: 1, Files: ["L", 14, 11], Caption: "x" }])
    expect(await screen.findByText("missing.jpg could not be fetched from Grist.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByRole("img", { name: "front.jpg" })).toBeInTheDocument()
  })

  it("AC-9 says when the row has no files, or no row is selected", async () => {
    const { emulator } = setup()
    await screen.findByRole("img", { name: "front.jpg" })
    emulator.selectRow(3)
    expect(await screen.findByText("This row has no files.")).toBeInTheDocument()
    emulator.selectRow(null)
    expect(await screen.findByText(/No row is selected/)).toBeInTheDocument()
  })

  it("AC-10 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByText("1 sur 3 : front.jpg")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Suivant" })).toBeInTheDocument()
  })

  it("AC-11 shows HTML file names and captions as text", async () => {
    setup(ROWS, { mode: "gallery" })
    expect(await screen.findByText("<i>Nantes</i>")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open <b>roof</b>.png (<i>Nantes</i>)" })).toBeInTheDocument()
    expect(document.querySelector("b, i")).toBeNull()
  })
})
