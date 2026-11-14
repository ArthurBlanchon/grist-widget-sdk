import "@testing-library/jest-dom/vitest"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument } from "grist-widget-sdk"

import App, { widget } from "./App"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const doc = (options: Record<string, unknown> = {}): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Applications",
  mode: "schema+data",
  accessToken: { token: "tok", baseUrl: "https://grist.example/api/docs/doc1", ttlMsecs: 60_000 },
  widgetOptions: options,
  tables: {
    Table1: {
      columns: { Name: { type: "Text" }, Files: { type: "Attachments" } },
      rows: [
        { id: 1, Name: "Léa", Files: ["L", 11] },
        { id: 2, Name: "Marc", Files: null },
      ],
    },
    _grist_Attachments: {
      columns: { fileName: { type: "Text" }, fileSize: { type: "Int" } },
      rows: [
        { id: 11, fileName: "cv-lea.pdf", fileSize: 1200 },
        { id: 12, fileName: "photo.png", fileSize: 3400 },
        { id: 13, fileName: "letter.pdf", fileSize: 900 },
      ],
    },
  },
})

function setup(options?: Record<string, unknown>) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(options), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings({ Files: "Files" })
  result.emulator.selectRow(1)
  return result
}

/** Grist's upload endpoint, answering with the next attachment ids. */
function uploads(...answers: (number[] | Error)[]) {
  const queue = [...answers]
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const next = queue.shift() ?? []
    if (next instanceof Error) return new Response(next.message, { status: 500, statusText: "Server error" })
    return new Response(JSON.stringify(next))
  })
}

const file = (name: string, type: string, size = 10) => {
  const f = new File(["x".repeat(Math.min(size, 64))], name, { type })
  Object.defineProperty(f, "size", { value: size })
  return f
}
const dropOn = (files: File[]) => fireEvent.drop(screen.getByRole("region", { name: "Drop files here" }), { dataTransfer: { files } })
const pick = (files: File[]) => fireEvent.change(screen.getByLabelText("Choose files", { selector: "input" }), { target: { files } })
const cell = (emulator: ReturnType<typeof setup>["emulator"], id = 1) =>
  (emulator.state.tables.get("Table1")!.rows.find((r) => r.id === id) as Record<string, unknown>).Files

describe("File uploader", () => {
  it("AC-1 lists the selected row's files by name", async () => {
    setup()
    expect(await screen.findByText("cv-lea.pdf")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "This row's files" })).getByText("cv-lea.pdf")).toBeInTheDocument()
  })

  it("AC-2 uploads dropped or picked files and adds them after the row's own, in one write", async () => {
    const { emulator } = setup()
    await screen.findByText("cv-lea.pdf")
    const fetchMock = uploads([12], [13])
    dropOn([file("photo.png", "image/png"), file("letter.pdf", "application/pdf")])
    await waitFor(() => expect(cell(emulator)).toEqual(["L", 11, 12, 13]))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/attachments\?auth=tok/)
    uploads([14])
    emulator.selectRow(2)
    await screen.findByText("No files yet.")
    pick([file("other.pdf", "application/pdf")])
    await waitFor(() => expect(cell(emulator, 2)).toEqual(["L", 14]))
  })

  it("AC-3 refuses a file over the size limit, naming it, and uploads the others", async () => {
    const { emulator } = setup({ maxSizeMB: 1 })
    await screen.findByText("cv-lea.pdf")
    uploads([12])
    dropOn([file("huge.mov", "video/quicktime", 5 * 1024 * 1024), file("photo.png", "image/png")])
    expect(await screen.findByText("huge.mov is larger than 1 MB.")).toBeInTheDocument()
    await waitFor(() => expect(cell(emulator)).toEqual(["L", 11, 12]))
  })

  it("AC-4 refuses a file of a type the limits don't take", async () => {
    const { emulator } = setup({ accept: "image/*, .pdf" })
    await screen.findByText("cv-lea.pdf")
    const fetchMock = uploads()
    dropOn([file("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")])
    expect(await screen.findByText("notes.docx is not a type this widget takes.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(cell(emulator)).toEqual(["L", 11])
  })

  it("AC-5 saves the accepted types and the size limit in the widget's options", async () => {
    const { emulator } = setup()
    await screen.findByText("cv-lea.pdf")
    expect(screen.getByText("Any type, up to 25 MB each.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Settings" }))
    fireEvent.change(screen.getByLabelText("Accepted types (blank for any)"), { target: { value: ".pdf" } })
    fireEvent.change(screen.getByLabelText("Largest file, in MB"), { target: { value: "2" } })
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }))
    await waitFor(() => expect(emulator.state.widgetOptions).toMatchObject({ accept: ".pdf", maxSizeMB: 2 }))
    expect(await screen.findByText(".pdf, up to 2 MB each.")).toBeInTheDocument()
  })

  it("AC-6 takes a file out of the row with Remove", async () => {
    const { emulator } = setup()
    await screen.findByText("cv-lea.pdf")
    fireEvent.click(screen.getByRole("button", { name: "Remove cv-lea.pdf from this row" }))
    await waitFor(() => expect(cell(emulator)).toBeNull())
  })

  it("AC-7 shows the error and leaves the cell as it was when an upload fails", async () => {
    const { emulator } = setup()
    await screen.findByText("cv-lea.pdf")
    uploads(new Error("disk full"))
    dropOn([file("photo.png", "image/png")])
    expect(await screen.findByText(/Grist did not take the files/)).toBeInTheDocument()
    expect(cell(emulator)).toEqual(["L", 11])
  })

  it("AC-8 says when no row is selected, and takes no files", async () => {
    const { emulator } = setup()
    await screen.findByText("cv-lea.pdf")
    emulator.selectRow(null)
    expect(await screen.findByText(/No row is selected/)).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Drop files here" })).not.toBeInTheDocument()
  })

  it("AC-9 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByRole("button", { name: "Choisir des fichiers" })).toBeInTheDocument()
    expect(screen.getByText("Tout type, jusqu'à 25 Mo chacun.")).toBeInTheDocument()
  })

  it("AC-10 shows an HTML file name as text", async () => {
    const { emulator } = setup()
    await screen.findByText("cv-lea.pdf")
    emulator.mutate.updateRow("_grist_Attachments", 11, { fileName: "<img src=x onerror=alert(1)>.pdf" })
    emulator.mutate.updateRow("Table1", 1, { Files: ["L", 11, 12] })
    expect(await screen.findByText("<img src=x onerror=alert(1)>.pdf")).toBeInTheDocument()
    expect(document.querySelector("img")).toBeNull()
  })

  it("AC-11 says how many files are uploading, and takes no others meanwhile", async () => {
    setup()
    await screen.findByText("cv-lea.pdf")
    let release!: () => void
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => (release = () => resolve(new Response("[12]")))),
    )
    dropOn([file("photo.png", "image/png")])
    expect(await screen.findByText("Uploading 1 file(s)…")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Choose files" })).toBeDisabled()
    expect(screen.getByRole("region", { name: "Drop files here" })).toHaveAttribute("aria-busy", "true")
    release()
    await waitFor(() => expect(screen.getByRole("button", { name: "Choose files" })).toBeEnabled())
  })
})
