import "@testing-library/jest-dom/vitest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, installJsdomStubs, renderWithGrist, screen, waitFor, within } from "grist-widget-sdk/emulator/testing"
import type { GristReplicaDocument, GristReplicaRow } from "grist-widget-sdk"

import App, { widget } from "./App"
import { link, recipients } from "./mail"

beforeAll(installJsdomStubs)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const day = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 1000
const MEMBERS: GristReplicaRow[] = [
  { id: 1, Name: "Zoé", Email: "zoe@example.org", Ends: day(2027, 3, 1), Fee: 1200.5, SentAt: null, SentDay: null, Done: false, Club: 2 },
  { id: 2, Name: "Ana", Email: "ana@example.org; bo@example.org", Ends: day(2027, 6, 9), Fee: 40, SentAt: null, SentDay: null, Done: false, Club: 1 },
  { id: 3, Name: "Nobody", Email: "not an address", Ends: null, Fee: 0, SentAt: null, SentDay: null, Done: false, Club: 0 },
]

const doc = (rows = MEMBERS, widgetOptions?: Record<string, unknown>): GristReplicaDocument => ({
  generatedAt: "1970-01-01T00:00:00.000Z",
  docName: "Members",
  mode: "schema+data",
  widgetOptions,
  tables: {
    Table1: {
      columns: {
        Name: { type: "Text", label: "Name", parentPos: 1 },
        Email: { type: "Text", label: "Email", parentPos: 2 },
        Ends: { type: "Date", label: "Ends", parentPos: 3 },
        Fee: { type: "Numeric", label: "Fee", parentPos: 4 },
        SentAt: { type: "DateTime:UTC", label: "SentAt", parentPos: 5 },
        SentDay: { type: "Date", label: "SentDay", parentPos: 6 },
        Done: { type: "Bool", label: "Done", parentPos: 7 },
        Club: { type: "Ref:Clubs", label: "Club", parentPos: 8, visibleColRef: 30 },
      },
      rows,
    },
    Clubs: { columns: { Name: { type: "Text", label: "Name", colRef: 30 } }, rows: [{ id: 1, Name: "Rowing" }, { id: 2, Name: "Chess" }] },
  },
})

const TEMPLATE = { subject: "Renewal for {{Name}}", body: "Dear {{Name}},\nyour membership ends on {{Ends}}; the fee is {{Fee}}.", client: "mailto" }

function setup(options: Record<string, unknown> | null = TEMPLATE, sent?: string, rows?: GristReplicaRow[]) {
  const result = renderWithGrist(<App />, { widget, emulator: { document: doc(rows, options ?? undefined), widgetInteraction: { access_level: "full" } } })
  result.emulator.setColumnMappings(sent ? { Email: "Email", Sent: sent } : { Email: "Email" })
  return result
}

const openLink = (to: string) => screen.findByRole("link", { name: `Open the e-mail to ${to}` })
const params = (href: string) => new URLSearchParams(href.slice(href.indexOf("?") + 1))
const cell = (emulator: ReturnType<typeof setup>["emulator"], id: number, col: string) =>
  (emulator.state.tables.get("Table1")!.rows.find((r) => r.id === id) as Record<string, unknown>)[col]

describe("Mail merge", () => {
  it("AC-1 puts each row's cells in its e-mail, as text", async () => {
    setup()
    const href = (await openLink("zoe@example.org")).getAttribute("href")!
    expect(params(href).get("subject")).toBe("Renewal for Zoé")
    expect(params(href).get("body")).toBe("Dear Zoé,\r\nyour membership ends on 3/1/2027; the fee is 1,200.5.")
    expect(screen.getByTestId("preview-subject")).toHaveTextContent("Renewal for Zoé")
  })

  it("AC-1 fills columns that aren't mapped, a reference as the text its column shows", async () => {
    // Grist sends a mapped widget only Email: Name and Club come from the table.
    setup({ ...TEMPLATE, subject: "{{Name}}, {{Club}} club" })
    await waitFor(async () => expect(params((await openLink("zoe@example.org")).getAttribute("href")!).get("subject")).toBe("Zoé, Chess club"))
  })

  it("AC-2 says when a placeholder names no column, and keeps it as written", async () => {
    setup({ ...TEMPLATE, subject: "Hi {{Nickname}}" })
    expect(await screen.findByText("Not a column of this table: Nickname. It is sent as written.")).toBeInTheDocument()
    expect(params((await openLink("zoe@example.org")).getAttribute("href")!).get("subject")).toBe("Hi {{Nickname}}")
  })

  it("AC-3 opens the e-mail in the chosen client", async () => {
    setup()
    expect((await openLink("zoe@example.org")).getAttribute("href")).toMatch(/^mailto:zoe@example\.org\?subject=Renewal%20for%20Zo%C3%A9&body=/)
    fireEvent.change(screen.getByLabelText("Open in"), { target: { value: "gmail" } })
    const gmail = (await openLink("zoe@example.org")).getAttribute("href")!
    expect(gmail.startsWith("https://mail.google.com/mail/?view=cm&fs=1&to=zoe%40example.org&su=Renewal%20for%20Zo%C3%A9&body=")).toBe(true)
    fireEvent.change(screen.getByLabelText("Open in"), { target: { value: "outlook" } })
    const outlook = (await openLink("zoe@example.org")).getAttribute("href")!
    expect(outlook.startsWith("https://outlook.office.com/mail/deeplink/compose?to=zoe%40example.org&subject=")).toBe(true)
    expect((await openLink("zoe@example.org")).getAttribute("target")).toBe("_blank")
  })

  it("AC-4 sends to every address of a cell, and leaves out a row without one", async () => {
    setup()
    expect((await openLink("ana@example.org, bo@example.org")).getAttribute("href")).toMatch(/^mailto:ana@example\.org,bo@example\.org\?/)
    expect(screen.getByText("2 of the 3 rows this section shows have an address.")).toBeInTheDocument()
    const row = document.querySelector('[data-row="3"]') as HTMLElement
    expect(within(row).queryByRole("link")).not.toBeInTheDocument()
    expect(row).toHaveTextContent("no valid address")
  })

  it("AC-5 keeps a value that tries to add a recipient or a header inside the text", async () => {
    expect(recipients("eve@example.org?bcc=all@example.org, x@y.z&cc=w@v.u")).toEqual([])
    const rows = [{ ...MEMBERS[0]!, Name: "Zoé&bcc=spy@example.org\nBcc: spy@example.org" }]
    setup(TEMPLATE, undefined, rows)
    const href = (await openLink("zoe@example.org")).getAttribute("href")!
    const p = params(href)
    expect([...p.keys()]).toEqual(["subject", "body"])
    expect(p.get("subject")).toBe("Renewal for Zoé&bcc=spy@example.org\nBcc: spy@example.org")
    expect(href.split("?")[0]).toBe("mailto:zoe@example.org")
    expect(link("gmail", ["a@b.co"], "s&to=x@y.z", "b").split("&").filter((x) => x.startsWith("to="))).toEqual(["to=a%40b.co"])
  })

  it("AC-6 saves the subject, message and client in the widget's options", async () => {
    const { emulator } = setup(null)
    fireEvent.change(await screen.findByLabelText("Subject"), { target: { value: "News for {{Name}}" } })
    fireEvent.change(screen.getByLabelText("Open in"), { target: { value: "gmail" } })
    fireEvent.click(screen.getByRole("button", { name: "Save the template" }))
    await waitFor(() => expect(emulator.state.widgetOptions).toMatchObject({ subject: "News for {{Name}}", client: "gmail", body: "Hello,\n\n\n\nBest regards" }))
    expect(await screen.findByRole("button", { name: "Template saved" })).toBeDisabled()
  })

  it("AC-7 logs the opening in the Sent column, as its type says", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T10:30:00Z") })
    try {
      let r = setup(TEMPLATE, "SentAt")
      fireEvent.click(await openLink("zoe@example.org"))
      await waitFor(() => expect(cell(r.emulator, 1, "SentAt")).toBe(Date.UTC(2026, 10, 15, 10, 30) / 1000))
      cleanup()
      r = setup(TEMPLATE, "SentDay")
      await waitFor(() => expect(document.querySelector('[data-row="1"]')).toBeInTheDocument())
      await new Promise((resolve) => setTimeout(resolve, 0))
      fireEvent.click(await openLink("zoe@example.org"))
      await waitFor(() => expect(cell(r.emulator, 1, "SentDay")).toBe(Date.UTC(2026, 10, 15) / 1000))
      cleanup()
      r = setup(TEMPLATE, "Done")
      await waitFor(() => expect(document.querySelector('[data-row="1"]')).toBeInTheDocument())
      await new Promise((resolve) => setTimeout(resolve, 0))
      fireEvent.click(await openLink("zoe@example.org"))
      await waitFor(() => expect(cell(r.emulator, 1, "Done")).toBe(true))
      expect(within(document.querySelector('[data-row="1"]') as HTMLElement).getByText("sent")).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("AC-8 opens the next row not yet opened or sent", async () => {
    setup(TEMPLATE, "Done", [{ ...MEMBERS[0]!, Done: true }, ...MEMBERS.slice(1)])
    fireEvent.click(await screen.findByRole("link", { name: "Open the next one (ana@example.org, bo@example.org)" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Every e-mail with an address is opened or sent.")
  })

  it("AC-9 warns when an e-mail's link is too long for some mail apps", async () => {
    setup({ ...TEMPLATE, body: "word ".repeat(500) })
    expect(await screen.findByText(/This e-mail is long/)).toBeInTheDocument()
  })

  it("AC-10 speaks French to a browser that prefers it", async () => {
    vi.stubGlobal("navigator", { ...navigator, languages: ["fr-FR"], language: "fr-FR" })
    setup(null)
    expect(await screen.findByRole("button", { name: "Modèle enregistré" })).toBeDisabled()
    expect(screen.getByLabelText("Objet")).toHaveValue("Bonjour")
  })
})
