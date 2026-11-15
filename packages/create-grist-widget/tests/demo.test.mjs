import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { DEMO_GRIST_PORT, demoArgs, demoRefusal, localPluginApi } from "../src/demo.mjs"
import { GRIST_IMAGE, openUrl } from "../src/grist-local.mjs"

function dirWith(pkg) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "demo-test-"))
  if (pkg) writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg))
  return dir
}

describe("demo", () => {
  it("takes Grist's port, and nothing else", () => {
    expect(demoArgs([])).toEqual({ gristPort: DEMO_GRIST_PORT, save: false })
    expect(demoArgs(["--port", "9090"])).toEqual({ gristPort: 9090, save: false })
    expect(demoArgs(["--", "--port", "9090"])).toEqual({ gristPort: 9090, save: false })
    expect(demoArgs(["--save"])).toEqual({ gristPort: DEMO_GRIST_PORT, save: true })
    expect(() => demoArgs(["--port", "x"])).toThrow(/port number/)
    expect(() => demoArgs(["--open"])).toThrow(/unknown argument/)
  })

  it("runs only in a grist-widget-sdk widget, with Docker up", () => {
    const up = () => true
    expect(demoRefusal(dirWith(null), { docker: up })).toMatch(/where package.json is/)
    expect(demoRefusal(dirWith({ name: "x" }), { docker: up })).toMatch(/not a grist-widget-sdk widget/)
    const widget = dirWith({ name: "w", dependencies: { "grist-widget-sdk": "^0.3.27" } })
    expect(demoRefusal(widget, { docker: () => false })).toMatch(/Docker isn't running/)
    expect(demoRefusal(widget, { docker: up })).toBeNull()
  })

  it("serves the widget the local Grist's plugin API", () => {
    const html = '<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>'
    expect(localPluginApi("http://localhost:8484").transformIndexHtml(html)).toBe(
      '<script src="http://localhost:8484/grist-plugin-api.js"></script>'
    )
  })

  it("opens the widget's page, signed in as the default user", () => {
    expect(openUrl("http://localhost:8484", "abc", 2)).toBe("http://localhost:8484/login?next=%2Fdoc%2Fabc%2Fp%2F2")
  })

  it("runs a pinned Grist", () => {
    if (!process.env.GRIST_IMAGE) expect(GRIST_IMAGE).toMatch(/^gristlabs\/grist:\d+\.\d+\.\d+$/)
  })
})

describe("a widget's demo data (src/app/demo.ts)", () => {
  const options = {
    requiredAccess: "full",
    columns: [{ name: "Title", type: "Text" }, { name: "Status", type: "Choice" }, { name: "Values", type: "Numeric", allowMultiple: true }],
  }
  const demo = {
    tables: {
      Tasks: {
        columns: { Title: "Text", Status: "Choice", Due: "Date", Tags: "ChoiceList", Revenue: "Numeric", Costs: "Numeric", Owner: "Ref:People", At: "DateTime" },
        rows: [
          { Title: "Brief", Status: "To do", Due: "2026-12-01", Tags: ["a", "b"], Revenue: 10, Costs: 4, Owner: 1, At: "2026-12-01T09:30:00Z" },
          { Title: "Draft", Status: "Done", Due: null, Tags: [], Revenue: 5, Costs: 2, Owner: 2 },
        ],
      },
      People: { columns: { Name: "Text" }, rows: [{ Name: "Ada" }, { Name: "Linus" }] },
    },
    mapping: { Values: ["Revenue", "Costs"] },
    options: { columns: ["To do", "Done"] },
  }

  it("builds every table, its choices from its rows, and Grist's cell encodings", async () => {
    const { demoSpec } = await import("../src/grist-local.mjs")
    const spec = demoSpec(options, demo)
    expect(spec.tables.map((t) => t.id)).toEqual(["Tasks", "People"])
    expect(spec.table).toBe("Tasks")
    const status = spec.tables[0].columns.find((c) => c.id === "Status")
    expect(JSON.parse(status.fields.widgetOptions).choices).toEqual(["To do", "Done"])
    expect(spec.tables[0].rows[0]).toMatchObject({ Due: Date.UTC(2026, 11, 1) / 1000, Tags: ["L", "a", "b"], Owner: 1 })
    expect(spec.tables[0].rows[1].Due).toBeNull()
    expect(spec.tables[0].rows[0].At).toBe(Date.UTC(2026, 11, 1, 9, 30) / 1000)
    expect(spec.tables[0].columns.find((c) => c.id === "At").fields.type).toBe("DateTime:UTC")
  })

  it("maps declared columns by name, or as the demo says, several for allowMultiple; carries the options", async () => {
    const { demoSpec } = await import("../src/grist-local.mjs")
    const spec = demoSpec(options, demo)
    expect(spec.mapping).toEqual({ Title: "Title", Status: "Status", Values: ["Revenue", "Costs"] })
    expect(spec.options).toEqual({ columns: ["To do", "Done"] })
  })

  it("refuses demo data Grist couldn't take, with a message", async () => {
    const { checkDemo } = await import("../src/grist-local.mjs")
    expect(checkDemo(demo)).toBe(demo)
    const t = (columns, rows = []) => ({ tables: { T: { columns, rows } } })
    for (const [bad, message] of [
      [null, /GristWidgetDemo/],
      [{ tables: { tasks: { columns: {}, rows: [] } } }, /table id/],
      [{ tables: { Table1: { columns: {}, rows: [] } } }, /table id/],
      [t({ manualSort: "Int" }), /column id/],
      [t({ in: "Text" }), /column id/],
      [t({ A: "Ref:Nope" }), /isn't one a demo takes/],
      [t({ A: "Choise" }), /isn't one a demo takes/],
      [t({ A: "Image" }), /isn't one a demo takes/],
      [{ ...t({ A: "Text" }), table: "U" }, /isn't one of its tables/],
      [t({ A: "Text" }, [{ Typo: "x" }]), /isn't one of its columns/],
      [t({ D: "Date" }, [{ D: "2026-12-1" }]), /YYYY-MM-DD/],
      [t({ D: "Date" }, [{ D: new Date() }]), /YYYY-MM-DD/],
      [t({ D: "DateTime" }, [{ D: "2026-12-01T10:00" }]), /offset/],
      [t({ N: "Numeric" }, [{ N: "1" }]), /a number/],
      [t({ C: "Text" }, [{ C: ["a"] }]), /a string/],
      [{ tables: { T: { columns: { R: "Ref:U" }, rows: [{ R: 3 }] }, U: { columns: { Name: "Text" }, rows: [{ Name: "a" }] } } }, /1 to 1/],
    ]) {
      expect(() => checkDemo(bad), JSON.stringify(bad)).toThrow(message)
    }
    expect(() => checkDemo(t({ D: "DateTime:Europe/Paris" }, [{ D: "2026-12-01T10:00:00+01:00" }]))).not.toThrow()
  })

  it("checks the mapping against the declaration: declared names, existing columns, one or several", async () => {
    const { demoSpec } = await import("../src/grist-local.mjs")
    const one = { tables: { T: { columns: { Title: "Text", Status: "Choice", A: "Numeric", B: "Numeric" }, rows: [] } } }
    expect(() => demoSpec(options, { ...one, mapping: { Nope: "A" } })).toThrow(/isn't a column the widget declares/)
    expect(() => demoSpec(options, { ...one, mapping: { Values: ["A", "Whne"] } })).toThrow(/isn't a column of T/)
    expect(() => demoSpec(options, { ...one, mapping: { Title: ["A"], Values: ["A"] } })).toThrow(/is one column/)
    expect(() => demoSpec(options, { tables: { T: { columns: { Status: "Choice" }, rows: [] } }, mapping: { Values: ["A"] } })).toThrow(/Title, which the widget requires/)
    expect(demoSpec(options, { ...one, mapping: { Values: "A" } }).mapping.Values).toEqual(["A"])
  })

  it("puts the widget's table first, keeps declared choices first, and versions the options", async () => {
    const { demoSpec } = await import("../src/grist-local.mjs")
    const spec = demoSpec({ ...options, optionsVersion: 2 }, { ...demo, table: "Tasks", tables: { People: demo.tables.People, Tasks: { ...demo.tables.Tasks, choices: { Status: ["Done", "Later"] } } } })
    expect(spec.tables.map((t) => t.id)).toEqual(["Tasks", "People"])
    const status = spec.tables[0].columns.find((c) => c.id === "Status")
    expect(JSON.parse(status.fields.widgetOptions).choices).toEqual(["Done", "Later", "To do"])
    expect(spec.options).toEqual({ columns: ["To do", "Done"], __version: 2 })
    expect(spec.tables[0].columns.find((c) => c.id === "Owner").ref).toBe("People")
  })

  it("colours choices and takes a RefList as a list of row positions", async () => {
    const { demoSpec } = await import("../src/grist-local.mjs")
    const tasks = {
      ...demo.tables.Tasks,
      columns: { ...demo.tables.Tasks.columns, Helpers: "RefList:People" },
      rows: demo.tables.Tasks.rows.map((r, i) => ({ ...r, Helpers: i ? [] : [1, 2] })),
      choiceColors: { Status: { Done: { fillColor: "#16A34A", textColor: "#FFFFFF" } } },
    }
    const spec = demoSpec(options, { ...demo, tables: { ...demo.tables, Tasks: tasks } })
    const status = spec.tables[0].columns.find((c) => c.id === "Status")
    expect(JSON.parse(status.fields.widgetOptions).choiceOptions).toEqual({ Done: { fillColor: "#16A34A", textColor: "#FFFFFF" } })
    expect(spec.tables[0].columns.find((c) => c.id === "Helpers").ref).toBe("People")
    expect(spec.tables[0].rows[0].Helpers).toEqual(["L", 1, 2])
    const bad = (t) => () => demoSpec(options, { ...demo, tables: { ...demo.tables, Tasks: { ...tasks, ...t } } })
    expect(bad({ rows: [{ ...tasks.rows[0], Helpers: [3] }] })).toThrow(/Helpers .*a list of row positions of People/)
    expect(bad({ choiceColors: { Status: { Done: { fillColor: "green" } } } })).toThrow(/choiceColors\.Status/)
    expect(bad({ choiceColors: { Title: { Done: { fillColor: "#16A34A" } } } })).toThrow(/choiceColors\.Title/)
  })
})

describe("the demo document (createDocument)", () => {
  // A fake Grist REST API: it answers what createDocument asks and keeps the section it saves.
  function fakeGrist({ table1 = false } = {}) {
    const saved = []
    const removed = []
    const api = async (method, url, body) => {
      if (url.endsWith("/docs")) return "doc1"
      if (url.includes("/sql?q=")) {
        const q = decodeURIComponent(url.split("q=")[1])
        if (q.includes("tableId = 'Table1'")) return { records: table1 ? [{ fields: { id: 1 } }] : [] }
        if (q.includes("from _grist_Tables where")) return { records: [{ fields: { id: 1, primaryViewId: 1 } }] }
        if (q.includes("from _grist_Tables_column where")) return { records: [{ fields: { id: 10, colId: "Name" } }, { fields: { id: 11, colId: "Email" } }] }
        if (q.includes("_grist_Views_section")) return { records: [{ fields: { id: 2 } }] }
        return { records: [] }
      }
      if (url.endsWith("/apply")) {
        if (body[0][0] === "CreateViewSection") return { retValues: [{ sectionRef: 5 }] }
        if (body[0][0] === "UpdateRecord") saved.push(JSON.parse(JSON.parse(body[0][3].options).customView))
        if (body[0][0] === "RemoveTable") {
          // As Grist: removing a table that isn't there fails.
          if (!table1 || removed.length) throw new Error("POST /apply: 500 No such table: Table1")
          removed.push(body[0][1])
        }
        return { retValues: [] }
      }
      return null
    }
    return { api, saved, removed }
  }

  it("removes the new document's Table1 once, and only when the Grist image made one", async () => {
    const { createDocument } = await import("../src/grist-local.mjs")
    const made = fakeGrist({ table1: true })
    await createDocument(made.api, 1, "Tasks", { requiredAccess: "read table" }, "http://w/")
    expect(made.removed).toEqual(["Table1"])
    const none = fakeGrist()
    await createDocument(none.api, 1, "Tasks", { requiredAccess: "read table" }, "http://w/")
    expect(none.removed).toEqual([])
  })

  it("uploads the demo's files and puts their attachment ids in the cells", async () => {
    const { createDocument, checkDemo } = await import("../src/grist-local.mjs")
    const grist = fakeGrist()
    const uploads = []
    const records = []
    const api = async (method, url, body) => {
      if (url.endsWith("/attachments")) {
        uploads.push(body.getAll("upload").map((f) => f.name))
        return [7, 8]
      }
      if (url.endsWith("/records")) records.push(...body.records.map((r) => r.fields))
      return grist.api(method, url, body)
    }
    const demo = {
      tables: { Visits: { columns: { Place: "Text", Photos: "Attachments" }, rows: [{ Place: "Roof", Photos: ["b.jpg", "a.pdf"] }, { Place: "Hall", Photos: [] }] } },
      files: { "a.pdf": Buffer.from("%PDF").toString("base64"), "b.jpg": Buffer.from("jpg").toString("base64") },
    }
    await createDocument(api, 1, "Visits", { requiredAccess: "full", columns: [{ name: "Files", type: "Attachments" }] }, "http://w/", { ...demo, mapping: { Files: "Photos" } })
    expect(uploads).toEqual([["a.pdf", "b.jpg"]])
    expect(records).toEqual([{ Place: "Roof", Photos: ["L", 8, 7] }, { Place: "Hall", Photos: null }])
    // Without its files (a static demo page), the cells stay empty and nothing is uploaded.
    records.length = 0
    await createDocument(api, 1, "Visits", { requiredAccess: "full", columns: [{ name: "Files", type: "Attachments" }] }, "http://w/", { ...demo, files: undefined, mapping: { Files: "Photos" } })
    expect(uploads).toHaveLength(1)
    expect(records).toEqual([{ Place: "Roof", Photos: null }, { Place: "Hall", Photos: null }])
    expect(() => checkDemo({ tables: { Visits: { columns: { Photos: "Attachments" }, rows: [{ Photos: ["../secret.pdf"] }] } } })).toThrow(/a list of file names of src\/app\/demo\//)
  })

  it("saves no mapping when nothing is mapped, as Grist does, and the mapping otherwise", async () => {
    const { createDocument } = await import("../src/grist-local.mjs")
    const none = fakeGrist()
    await createDocument(none.api, 1, "Template", { requiredAccess: "full" }, "http://w/")
    expect(none.saved[0].columnsMapping).toBeNull()
    const mapped = fakeGrist()
    await createDocument(mapped.api, 1, "Mail", { requiredAccess: "full", columns: [{ name: "Email" }] }, "http://w/")
    expect(mapped.saved[0].columnsMapping).toEqual({ Email: 11 })
  })
})

describe("the demo's files (src/app/demo/)", () => {
  it("reads plain files of the folder, and refuses a link or a missing one", async () => {
    const { mkdirSync, symlinkSync } = await import("node:fs")
    const { withDemoFiles } = await import("../src/grist-local.mjs")
    const widget = mkdtempSync(path.join(os.tmpdir(), "demo-files-"))
    const dir = path.join(widget, "src", "app", "demo")
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, "photo.jpg"), "jpg")
    writeFileSync(path.join(widget, "secret.txt"), "token")
    symlinkSync(path.join(widget, "secret.txt"), path.join(dir, "notes.txt"))
    const demo = (names) => ({ tables: { T: { columns: { Files: "Attachments" }, rows: [{ Files: names }] } } })
    expect(withDemoFiles(demo(["photo.jpg"]), widget).files).toEqual({ "photo.jpg": Buffer.from("jpg").toString("base64") })
    expect(() => withDemoFiles(demo(["notes.txt"]), widget)).toThrow(/isn't a plain file of that folder/)
    expect(() => withDemoFiles(demo(["gone.pdf"]), widget)).toThrow(/gone.pdf isn't in src\/app\/demo/)
  })
})
