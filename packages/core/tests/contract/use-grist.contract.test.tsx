/**
 * The `useGrist()` contract: what widgets rely on, member by member, through
 * public entry points only. The runtime under it can change; these can't,
 * except in a breaking release that says what replaces a member.
 *
 * Every member of the result has a `describe("<member>")` block here: the
 * first test fails when a member exists without one.
 */

import { readFileSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"

import { presets } from "../../src/emulator"
import { actionsOf, eventsOf } from "../../src/emulator/testing"
import { renderProbe, settle, untilReady } from "./harness"
import type { UseGristOptions } from "../../src/sdk"
import { resetDeprecationWarnings } from "../../src/sdk/helpers/deprecate"

/** todoList with a REST access token, for the attachment and REST members. */
const withToken = () => ({
  emulator: {
    document: {
      ...presets.todoList(),
      accessToken: { token: "tok", baseUrl: "https://grist.example/api/docs/doc1", ttlMsecs: 60_000 },
    },
  },
})

const MEMBERS = [
  "status",
  "error",
  "reload",
  "theme",
  "record",
  "records",
  "mappedRecord",
  "mappedRecords",
  "cellIssues",
  "mappings",
  "columnMappingStatus",
  "mode",
  "resolveMappedColumnId",
  "mapBack",
  "updateRecord",
  "addRecord",
  "currentTableId",
  "fetchRows",
  "listTables",
  "listColumns",
  "table",
  "getTable",
  "actionStatus",
  "actionError",
  "applyActions",
  "widgetOptions",
  "setWidgetOptions",
  "patchWidgetOptions",
  "setCursorPosition",
  "setLinkedRowSelection",
  "getAttachmentUrl",
  "fetchAttachmentBlob",
  "uploadAttachment",
  "fetchWithAuth",
] as const

/** Still on the result, warning once in development; removed in 1.0. */
const DEPRECATED = ["isAvailable", "isReady", "fetchSelectedTable", "fetchTable", "fetchTableRows"] as const

const MAPPED = {
  requiredAccess: "read table",
  columns: [
    { name: "Label", type: "Text" },
    { name: "Flag", type: "Bool", optional: true },
  ],
} as const

describe("the contract covers every member", () => {
  it("each listed member exists on useGrist() and has a describe block", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    const keys = Object.keys(w())
    for (const m of MEMBERS) expect(keys, `useGrist().${m}`).toContain(m)
    const source = readFileSync(new URL(import.meta.url), "utf8")
    for (const m of [...MEMBERS, ...DEPRECATED]) expect(source, `describe("${m}")`).toContain(`describe("${m}"`)
    for (const m of DEPRECATED) expect(m in w(), `useGrist().${m}`).toBe(true)
  })
})

describe("deprecated members", () => {
  it("each works, and warns once in development with what replaces it", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    resetDeprecationWarnings()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    try {
      for (let i = 0; i < 2; i++) {
        void w().isAvailable
        void w().isReady
        await w().fetchSelectedTable()
        await w().fetchTable("Tasks")
        await w().fetchTableRows("Tasks")
      }
      const lines = warn.mock.calls.map((c) => String(c[0]))
      expect(lines).toHaveLength(DEPRECATED.length)
      for (const m of DEPRECATED) expect(lines.some((l) => l.includes(`useGrist().${m}`) && l.includes("deprecated"))).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })

  it("stay out of a spread of the result", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    const copy = { ...w() }
    expect("isReady" in copy || "isAvailable" in copy).toBe(false)
  })
})

describe("status", () => {
  it("is booting, then ready inside Grist", async () => {
    const { w } = renderProbe()
    expect(["booting", "ready"]).toContain(w().status)
    await untilReady(w)
  })

  it("is error when Grist grants less access than the widget declares", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    await settle(() => emulator.setInteraction({ access_level: "read table" }))
    await waitFor(() => expect(w().status).toBe("error"))
  })
})

describe("isAvailable", () => {
  it("is true inside Grist once connected", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    expect(w().isAvailable).toBe(true)
  })
})

describe("isReady", () => {
  it("follows status === ready", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    expect(w().isReady).toBe(true)
  })
})

describe("error", () => {
  it("is null when connected, a message when access is refused", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    expect(w().error).toBeNull()
    await settle(() => emulator.setInteraction({ access_level: "none" }))
    await waitFor(() => expect(w().error).toMatch(/access/i))
  })
})

describe("reload", () => {
  it("reconnects and comes back ready with the same data", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    await settle(() => w().reload())
    await untilReady(w)
    await waitFor(() => expect(w().records).toHaveLength(3))
  })
})

describe("theme", () => {
  it("follows Grist's theme", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "read table" }, { emulator: { document: presets.todoList(), initialTheme: "light" } })
    await untilReady(w)
    await waitFor(() => expect(w().theme).toBe("light"))
    await settle(() => emulator.theme.set("dark"))
    await waitFor(() => expect(w().theme).toBe("dark"))
  })
})

describe("record", () => {
  it("is the selected row, and follows the cursor", async () => {
    const { w, emulator } = renderProbe()
    await untilReady(w)
    await waitFor(() => expect(w().record?.title).toBe("Buy milk"))
    await settle(() => emulator.selectRow(3))
    await waitFor(() => expect(w().record?.title).toBe("Ship it"))
  })
})

describe("records", () => {
  it("is every row of the section, and follows data changes", async () => {
    const { w, emulator } = renderProbe()
    await untilReady(w)
    await waitFor(() => expect(w().records?.map((r) => r.id)).toEqual([1, 2, 3]))
    await settle(() => emulator.mutate.addRow("Tasks", { title: "Fourth", done: false, priority: "low" }))
    await waitFor(() => expect(w().records).toHaveLength(4))
  })
})

describe("mappings", () => {
  it("is the logical → real column map Grist reports", async () => {
    const { w, emulator } = renderProbe(MAPPED)
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Label: "title", Flag: "done" }))
    await waitFor(() => expect(w().mappings).toMatchObject({ Label: "title", Flag: "done" }))
  })
})

describe("columnMappingStatus", () => {
  it("lists the required columns not mapped yet, then is ok", async () => {
    const { w, emulator } = renderProbe(MAPPED)
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({}))
    await waitFor(() => expect(w().columnMappingStatus).toMatchObject({ ok: false, missing: ["Label"] }))
    await settle(() => emulator.setColumnMappings({ Label: "title" }))
    await waitFor(() => expect(w().columnMappingStatus.ok).toBe(true))
  })
})

describe("mappedRecord", () => {
  it("is the selected row under the logical names, null until mapped", async () => {
    const { w, emulator } = renderProbe(MAPPED)
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({}))
    await waitFor(() => expect(w().mappedRecord).toBeNull())
    await settle(() => emulator.setColumnMappings({ Label: "title", Flag: "done" }))
    await waitFor(() => expect(w().mappedRecord).toMatchObject({ Label: "Buy milk", Flag: false }))
  })
})

describe("mappedRecords", () => {
  it("is every row under the declared names, typed, with read-table access", async () => {
    const { w, emulator } = renderProbe(MAPPED)
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Label: "title", Flag: "done" }))
    await waitFor(() =>
      expect(w().mappedRecords).toEqual([
        { id: 1, Label: "Buy milk", Flag: false },
        { id: 2, Label: "Write the SOTA emulator", Flag: true },
        { id: 3, Label: "Ship it", Flag: false },
      ])
    )
  })
})

describe("cellIssues", () => {
  it("names the mapped cells that don't match their declared type, and nulls them", async () => {
    const { w, emulator } = renderProbe({
      requiredAccess: "read table",
      columns: [{ name: "Label", type: "Text" }, { name: "Count", type: "Numeric" }],
    })
    await untilReady(w)
    // A Numeric declaration mapped to a Text column (Grist's panel wouldn't offer it; a type changed later would).
    await settle(() => emulator.setColumnMappings({ Label: "title", Count: "title" }))
    await waitFor(() => expect(w().cellIssues).toHaveLength(3))
    expect(w().cellIssues[0]).toEqual({ rowId: 1, column: "Count", message: "not a number", value: "Buy milk" })
    expect(w().mappedRecord).toMatchObject({ Label: "Buy milk", Count: null })
    await settle(() => emulator.setColumnMappings({ Label: "title", Count: undefined as never }))
  })
})

describe("resolveMappedColumnId", () => {
  it("gives the real column id of a logical name", async () => {
    const { w, emulator } = renderProbe(MAPPED)
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Label: "title" }))
    await waitFor(() => expect(w().resolveMappedColumnId("Label")).toBe("title"))
  })
})

describe("mapBack", () => {
  it("turns a logical-name patch into real column ids", async () => {
    const { w, emulator } = renderProbe(MAPPED)
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Label: "title", Flag: "done" }))
    await waitFor(() => expect(w().mapBack({ Label: "x", Flag: true })).toEqual({ title: "x", done: true }))
  })
})

/** todoList with a ChoiceList, a RefList and a Date column, values stored as Grist stores them. */
const withTypedColumns = () => {
  const doc = presets.todoList()
  const tasks = doc.tables.Tasks!
  return {
    emulator: {
      document: {
        ...doc,
        tables: {
          Tasks: {
            ...tasks,
            columns: {
              ...tasks.columns,
              tags: { type: "ChoiceList", label: "Tags", widgetOptions: { choices: ["home", "work"] } },
              links: { type: "RefList:Tasks", label: "Links" },
              due: { type: "Date", label: "Due" },
            },
            rows: (tasks.rows ?? []).map((row) => ({ ...row, tags: ["L", "home"], links: ["L", 2], due: 1_794_441_600 })),
          },
        },
      },
    },
  }
}

const TYPED: UseGristOptions = {
  requiredAccess: "full",
  columns: [
    { name: "Tags", type: "ChoiceList" },
    { name: "Links", type: "RefList" },
    { name: "Due", type: "Date" },
  ],
}

describe("mapBack encodes each value for its declared type", () => {
  it("writes back what mappedRecord gives, stored as Grist stores it", async () => {
    const { w, emulator } = renderProbe(TYPED, withTypedColumns())
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Tags: "tags", Links: "links", Due: "due" }))
    await waitFor(() => expect(w().mappedRecord).toMatchObject({ Tags: ["home"], Links: [2] }))
    const read = w().mappedRecord as { Tags: string[]; Links: number[]; Due: Date }
    expect(read.Due).toBeInstanceOf(Date)

    const fields = w().mapBack({ Tags: [...read.Tags, "work"], Links: [...read.Links, 3], Due: new Date(Date.UTC(2026, 11, 1)) })
    expect(fields).toEqual({ tags: ["L", "home", "work"], links: ["L", 2, 3], due: 1_796_083_200 })
    await settle(() => w().table.update({ id: 1, fields }))

    const stored = emulator.state.tables.get("Tasks")!.rows.find((r) => r.id === 1)!
    expect(stored).toMatchObject({ tags: ["L", "home", "work"], links: ["L", 2, 3], due: 1_796_083_200 })
    await waitFor(() => expect(w().mappedRecord).toMatchObject({ Tags: ["home", "work"], Links: [2, 3] }))
    expect(w().cellIssues).toEqual([])
  })

  it("leaves a value already encoded as it is", async () => {
    const { w, emulator } = renderProbe(TYPED, withTypedColumns())
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Tags: "tags", Links: "links", Due: "due" }))
    await waitFor(() => expect(w().columnMappingStatus.ok).toBe(true))
    expect(w().mapBack({ Links: ["L", 2] })).toEqual({ links: ["L", 2] })
  })
})

describe("the emulator stores a bare list the way Grist does", () => {
  it("is an error cell, reported in cellIssues, when a write skips mapBack", async () => {
    const { w, emulator } = renderProbe(TYPED, withTypedColumns())
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Tags: "tags", Links: "links", Due: "due" }))
    await settle(() => w().table.update({ id: 1, fields: { tags: ["home", "work"] } }))
    expect(emulator.state.tables.get("Tasks")!.rows.find((r) => r.id === 1)!.tags).toEqual(["E", "KeyError"])
    await waitFor(() => expect(w().cellIssues).toEqual([expect.objectContaining({ rowId: 1, column: "Tags" })]))
  })
})

describe("updateRecord", () => {
  it("writes a patch under declared names to the selected row, encoded for each declared type", async () => {
    const { w, emulator } = renderProbe(TYPED, withTypedColumns())
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Tags: "tags", Links: "links", Due: "due" }))
    await waitFor(() => expect(w().mappedRecord).toMatchObject({ Tags: ["home"] }))
    await settle(() => w().updateRecord({ Tags: ["home", "work"], Due: new Date(Date.UTC(2026, 11, 1)) }))
    const stored = emulator.state.tables.get("Tasks")!.rows.find((r) => r.id === 1)!
    expect(stored).toMatchObject({ tags: ["L", "home", "work"], due: 1_796_083_200 })
  })

  it("takes a row id, and rejects with no row selected and none given", async () => {
    const { w, emulator } = renderProbe(TYPED, withTypedColumns())
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Tags: "tags", Links: "links", Due: "due" }))
    await settle(() => w().updateRecord(3, { Links: [1] }))
    expect(emulator.state.tables.get("Tasks")!.rows.find((r) => r.id === 3)!.links).toEqual(["L", 1])
    await settle(() => emulator.selectRow(null))
    await expect(w().updateRecord({ Links: [1] })).rejects.toThrow(/no row is selected/)
  })
})

describe("addRecord", () => {
  it("adds a row from a patch under declared names and resolves to its id", async () => {
    const { w, emulator } = renderProbe(TYPED, withTypedColumns())
    await untilReady(w)
    await settle(() => emulator.setColumnMappings({ Tags: "tags", Links: "links", Due: "due" }))
    let id = 0
    await settle(async () => {
      id = await w().addRecord({ Tags: ["work"] })
    })
    expect(id).toBe(4)
    expect(emulator.state.tables.get("Tasks")!.rows.find((r) => r.id === 4)!.tags).toEqual(["L", "work"])
  })
})

describe("mode", () => {
  it("is row on a row, new-row on the add-row placeholder, empty with no selection", async () => {
    const { w, emulator } = renderProbe()
    await untilReady(w)
    await waitFor(() => expect(w().mode).toBe("row"))
    await settle(() => emulator.selectRow("new"))
    await waitFor(() => expect(w().mode).toBe("new-row"))
    await settle(() => emulator.selectRow(null))
    await waitFor(() => expect(w().mode).toBe("empty"))
  })
})

describe("currentTableId", () => {
  it("is the section's table", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    await waitFor(() => expect(w().currentTableId).toBe("Tasks"))
  })
})

describe("fetchRows", () => {
  it("reads the section's rows, in its order, without a table id", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    const rows = await w().fetchRows()
    expect(rows.map((r) => [r.id, r.title])).toEqual([
      [1, "Buy milk"],
      [2, "Write the SOTA emulator"],
      [3, "Ship it"],
    ])
  })

  it("reads any table as rows with full access", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    const rows = await w().fetchRows("Tasks")
    expect(rows.map((r) => r.title)).toEqual(["Buy milk", "Write the SOTA emulator", "Ship it"])
  })

  it("gives Grist's columns with { columnar: true }", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    expect((await w().fetchRows({ columnar: true })).title).toEqual(["Buy milk", "Write the SOTA emulator", "Ship it"])
    expect((await w().fetchRows("Tasks", { columnar: true })).id).toEqual([1, 2, 3])
  })
})

describe("fetchSelectedTable", () => {
  it("reads the section's rows, column-oriented", async () => {
    const { w } = renderProbe()
    await untilReady(w)
    const data = await w().fetchSelectedTable()
    expect(data.title).toEqual(["Buy milk", "Write the SOTA emulator", "Ship it"])
  })
})

describe("fetchTable", () => {
  it("reads any table with full access", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    const data = await w().fetchTable("Tasks")
    expect(data.id).toEqual([1, 2, 3])
  })
})

describe("fetchTableRows", () => {
  it("reads any table as rows with full access", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    const rows = await w().fetchTableRows("Tasks")
    expect(rows.map((r) => r.title)).toEqual(["Buy milk", "Write the SOTA emulator", "Ship it"])
  })
})

describe("listTables", () => {
  it("lists the document's user tables", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    expect(await w().listTables()).toEqual(["Tasks"])
  })
})

describe("listColumns", () => {
  it("lists a table's columns with their types", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    const cols = await w().listColumns("Tasks")
    expect(cols.map((c) => [c.colId, c.type])).toEqual(
      expect.arrayContaining([
        ["title", "Text"],
        ["done", "Bool"],
      ])
    )
  })
})

describe("table", () => {
  it("creates, updates and destroys rows in the section's table", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    await waitFor(() => expect(w().currentTableId).toBe("Tasks"))
    await settle(() => w().table.create({ fields: { title: "New", done: false, priority: "low" } }))
    await settle(() => w().table.update({ id: 1, fields: { title: "Renamed" } }))
    await settle(() => w().table.destroy(2))
    const kinds = actionsOf(emulator).map((a) => a[0])
    expect(kinds).toEqual(expect.arrayContaining(["AddRecord", "UpdateRecord", "RemoveRecord"]))
    await waitFor(() => expect(w().records?.map((r) => r.title)).toEqual(["Renamed", "Ship it", "New"]))
  })
})

describe("getTable", () => {
  it("writes to a table by id", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    await settle(() => w().getTable("Tasks").create({ fields: { title: "Elsewhere" } }))
    expect(emulator.state.tables.get("Tasks")!.rows.some((r) => r.title === "Elsewhere")).toBe(true)
  })
})

describe("actionStatus", () => {
  it("is idle, and idle again after a write", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    await waitFor(() => expect(w().currentTableId).toBe("Tasks"))
    expect(w().actionStatus).toBe("idle")
    await settle(() => w().table.create({ fields: { title: "x" } }))
    await waitFor(() => expect(w().actionStatus).toBe("idle"))
  })
})

describe("actionError", () => {
  it("holds the message of a write that failed", async () => {
    const { w } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    await settle(async () => {
      await w()
        .getTable("NoSuchTable")
        .create({ fields: { a: 1 } })
        .catch(() => {})
    })
    await waitFor(() => expect(w().actionError).toBeTruthy())
  })
})

describe("applyActions", () => {
  it("applies user actions in one call", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" })
    await untilReady(w)
    await settle(() => w().applyActions([["AddRecord", "Tasks", null, { title: "Batch" }]]))
    expect(actionsOf(emulator).some((a) => a[0] === "AddRecord")).toBe(true)
  })
})

describe("widgetOptions", () => {
  it("is the options Grist holds for the widget, and follows changes", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "read table" }, {
      emulator: { document: presets.todoList(), widgetOptions: { color: "red" } },
    })
    await untilReady(w)
    await waitFor(() => expect(w().widgetOptions).toMatchObject({ color: "red" }))
    await settle(() => emulator.setOptions({ color: "blue" }))
    await waitFor(() => expect(w().widgetOptions).toMatchObject({ color: "blue" }))
  })
})

describe("setWidgetOptions", () => {
  it("replaces the widget's options", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" }, {
      emulator: { document: presets.todoList(), widgetOptions: { a: 1 } },
    })
    await untilReady(w)
    await settle(() => w().setWidgetOptions({ b: 2 }))
    expect(emulator.state.widgetOptions).toEqual({ b: 2 })
  })
})

describe("patchWidgetOptions", () => {
  it("merges into the widget's options", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "full" }, {
      emulator: { document: presets.todoList(), widgetOptions: { a: 1 } },
    })
    await untilReady(w)
    await waitFor(() => expect(w().widgetOptions).toMatchObject({ a: 1 }))
    await settle(() => w().patchWidgetOptions({ b: 2 }))
    expect(emulator.state.widgetOptions).toEqual({ a: 1, b: 2 })
  })
})

describe("setCursorPosition", () => {
  it("moves Grist's cursor", async () => {
    const { w, emulator } = renderProbe()
    await untilReady(w)
    await settle(() => w().setCursorPosition({ rowId: 3 }))
    expect(emulator.state.selection.rowId).toBe(3)
  })
})

describe("setLinkedRowSelection", () => {
  it("tells Grist which rows the widget selects", async () => {
    const { w, emulator } = renderProbe({ requiredAccess: "read table", allowSelectBy: true })
    await untilReady(w)
    await settle(() => w().setLinkedRowSelection([1, 3]))
    expect(eventsOf(emulator).some((e) => e.type === "cursor-change")).toBe(true)
  })
})

describe("getAttachmentUrl", () => {
  it("builds a download URL with an access token", async () => {
    const { w } = renderProbe({ requiredAccess: "full" }, withToken())
    await untilReady(w)
    const url = await w().getAttachmentUrl("7")
    expect(url).toMatch(/attachments\/7\/download\?auth=/)
  })
})

describe("fetchWithAuth", () => {
  it("calls the document's REST API with the access token, same origin only", async () => {
    const { w } = renderProbe({ requiredAccess: "full" }, withToken())
    await untilReady(w)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"))
    try {
      await w().fetchWithAuth("/tables/Tasks/records")
      const called = String(fetchMock.mock.calls[0]![0])
      expect(called).toBe("https://grist.example/api/docs/doc1/tables/Tasks/records?auth=tok")
      await expect(w().fetchWithAuth("https://evil.example/x")).rejects.toThrow(/refusing/)
    } finally {
      fetchMock.mockRestore()
    }
  })
})

describe("fetchAttachmentBlob", () => {
  it("downloads an attachment", async () => {
    const { w } = renderProbe({ requiredAccess: "full" }, withToken())
    await untilReady(w)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("hi"))
    try {
      const got = await w().fetchAttachmentBlob("7")
      expect(got.blob.size).toBe(2)
      expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/attachments\/7\/download\?auth=tok/)
    } finally {
      fetchMock.mockRestore()
    }
  })
})

describe("uploadAttachment", () => {
  it("posts the file and returns the new attachment ids", async () => {
    const { w } = renderProbe({ requiredAccess: "full" }, withToken())
    await untilReady(w)
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[12]"))
    try {
      const got = await w().uploadAttachment(new Blob(["x"]), { fileName: "a.txt" })
      expect(got.ids).toEqual(["12"])
      expect(String(fetchMock.mock.calls[0]![0])).toMatch(/\/attachments\?auth=/)
    } finally {
      fetchMock.mockRestore()
    }
  })
})

describe("GristBoundary", () => {
  it("renders the widget once connected", async () => {
    const { w } = renderProbe({ requiredAccess: "read table" }, {}, { boundary: true })
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("ready"))
    expect(w().status).toBe("ready")
  })

  it("asks for more access instead of the widget when Grist refuses it", async () => {
    const { emulator } = renderProbe({ requiredAccess: "full" }, {}, { boundary: true })
    await waitFor(() => expect(screen.getByTestId("probe")).toBeInTheDocument())
    await settle(() => emulator.setInteraction({ access_level: "read table" }))
    await waitFor(() => expect(screen.queryByTestId("probe")).not.toBeInTheDocument())
    expect(screen.getByText(/More access needed/i)).toBeInTheDocument()
  })

  it("asks to map the columns while a required one is missing", async () => {
    const { emulator } = renderProbe(MAPPED, {}, { boundary: true })
    await settle(() => emulator.setColumnMappings({}))
    await waitFor(() => expect(screen.getByText(/Map your columns/i)).toBeInTheDocument())
    await settle(() => emulator.setColumnMappings({ Label: "title" }))
    await waitFor(() => expect(screen.getByTestId("probe")).toBeInTheDocument())
  })
})
