import "@testing-library/jest-dom/vitest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, renderWithGrist, screen, waitFor } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"
import { demo } from "./demo"

/** What the saved image was drawn with: jsdom has no canvas, so a minimal 2D context records it. */
let drawn: { fills: string[]; strokes: string[]; text: string[] }

beforeEach(() => {
  drawn = { fills: [], strokes: [], text: [] }
  const ctx = {
    set fillStyle(v: string) {
      drawn.fills.push(v)
    },
    set strokeStyle(v: string) {
      drawn.strokes.push(v)
    },
    fillRect() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fillText(text: string) {
      drawn.text.push(text)
    },
  }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, type?: string) {
    cb(new Blob(["png"], { type: type ?? "image/png" }))
  }
  URL.createObjectURL = vi.fn(() => "blob:signature")
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const ROWS: GristReplicaRow[] = [
  { id: 1, Customer: "Acme", Signature: null, SignedBy: "", SignedAt: null },
  { id: 2, Customer: "Brindille", Signature: ["L", 7], SignedBy: "Léa", SignedAt: Date.UTC(2026, 10, 14, 9, 30) / 1000 },
]

const doc = (rows = ROWS): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Deliveries",
  mode: "schema+data",
  accessToken: { token: "tok", baseUrl: "https://grist.example/api/docs/doc1", ttlMsecs: 60_000 },
  tables: {
    Table1: {
      columns: { Customer: { type: "Text" }, Signature: { type: "Attachments" }, SignedBy: { type: "Text" }, SignedAt: { type: "DateTime:UTC" } },
      rows,
    },
  },
})

function setup({ mappings = { Signature: "Signature", SignedBy: "SignedBy", SignedAt: "SignedAt" }, select = 1, rows }: { mappings?: Record<string, string>; select?: number | null; rows?: GristReplicaRow[] } = {}) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(rows), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings(mappings)
  result.emulator.selectRow(select)
  return result
}

/** Grist's upload endpoint answers with the new attachment's id; downloads answer with an image. */
function grist(upload: number[] | Error = [21]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (/\/download/.test(String(input))) return new Response("png", { headers: { "content-type": "image/png" } })
    if (upload instanceof Error) return new Response(upload.message, { status: 500 })
    return new Response(JSON.stringify(upload))
  })
}

const pad = () => screen.getByRole("img", { name: /Signature pad/ })
function draw() {
  fireEvent.pointerDown(pad(), { pointerId: 1, clientX: 10, clientY: 10 })
  fireEvent.pointerMove(pad(), { pointerId: 1, clientX: 40, clientY: 20 })
  fireEvent.pointerUp(pad(), { pointerId: 1 })
}
const row = (emulator: ReturnType<typeof setup>["emulator"], id = 1) =>
  emulator.state.tables.get("Table1")!.rows.find((r) => r.id === id) as Record<string, unknown>

describe("Signature pad", () => {
  it("AC-1 makes a signature from what is drawn, and enables Save only then", async () => {
    setup()
    expect(await screen.findByRole("img", { name: "Signature pad, empty: draw your signature here" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save signature" })).toBeDisabled()
    draw()
    expect(screen.getByRole("img", { name: "Signature pad, with a signature drawn" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save signature" })).toBeEnabled()
  })

  it("AC-2 saves the signature as a PNG, dark on white, in place of a previous one", async () => {
    const { emulator } = setup({ rows: [{ ...ROWS[1]!, id: 1 }] })
    await screen.findByRole("button", { name: "Sign again" })
    const fetchMock = grist([21])
    fireEvent.click(screen.getByRole("button", { name: "Sign again" }))
    draw()
    drawn = { fills: [], strokes: [], text: [] }
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }))
    await waitFor(() => expect(row(emulator).Signature).toEqual(["L", 21]))
    expect(drawn.fills[0]).toBe("white")
    expect(drawn.strokes).toContain("black")
    const upload = fetchMock.mock.calls.find(([u]) => /\/attachments\?/.test(String(u)))!
    const form = (upload[1] as RequestInit).body as FormData
    expect((form.get("upload") as File).type).toBe("image/png")
  })

  it("AC-3 writes the typed name and the time of signing", async () => {
    const { emulator } = setup()
    await screen.findByRole("img", { name: /Signature pad/ })
    grist([21])
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Marc Petit" } })
    draw()
    const before = Date.now() / 1000
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }))
    await waitFor(() => expect(row(emulator).SignedBy).toBe("Marc Petit"))
    expect(Number(row(emulator).SignedAt)).toBeGreaterThanOrEqual(Math.floor(before))
  })

  it("AC-4 empties the pad with Clear", async () => {
    setup()
    await screen.findByRole("img", { name: /Signature pad/ })
    draw()
    fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    expect(screen.getByRole("img", { name: "Signature pad, empty: draw your signature here" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save signature" })).toBeDisabled()
  })

  it("AC-5 takes a typed signature from the keyboard", async () => {
    const { emulator } = setup()
    await screen.findByRole("img", { name: /Signature pad/ })
    grist([22])
    fireEvent.click(screen.getByRole("button", { name: "Type instead" }))
    fireEvent.change(screen.getByLabelText("Type your signature"), { target: { value: "Zoé" } })
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }))
    await waitFor(() => expect(row(emulator).Signature).toEqual(["L", 22]))
    expect(drawn.text).toContain("Zoé")
    expect(row(emulator).SignedBy).toBe("Zoé")
  })

  it("AC-6 shows a signed row's signature, who and when, and signs again", async () => {
    grist()
    setup({ select: 2 })
    expect(await screen.findByRole("img", { name: "Signature" })).toHaveAttribute("src", "blob:signature")
    expect(screen.getByText(/Signed by Léa/)).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Sign again" }))
    expect(screen.getByRole("img", { name: /Signature pad/ })).toBeInTheDocument()
  })

  it("AC-7 shows the error and leaves the row as it was when the upload fails", async () => {
    const { emulator } = setup()
    await screen.findByRole("img", { name: /Signature pad/ })
    grist(new Error("disk full"))
    draw()
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }))
    expect(await screen.findByText(/Grist did not save the signature/)).toBeInTheDocument()
    expect(row(emulator).Signature).toBeNull()
  })

  it("AC-8 says when no row is selected", async () => {
    setup({ select: null })
    expect(await screen.findByText(/No row is selected/)).toBeInTheDocument()
  })

  it("AC-9 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup()
    expect(await screen.findByRole("button", { name: "Enregistrer la signature" })).toBeInTheDocument()
    expect(screen.getByLabelText("Votre nom")).toBeInTheDocument()
  })

  it("AC-10 shows a signer's name that is HTML as text", async () => {
    grist()
    setup({ select: 2, rows: [ROWS[0]!, { ...ROWS[1]!, SignedBy: "<img src=x onerror=alert(1)>" }] })
    expect(await screen.findByText(/Signed by <img src=x onerror=alert\(1\)>/)).toBeInTheDocument()
    expect(document.querySelectorAll("img[src=x]")).toHaveLength(0)
  })
})

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
