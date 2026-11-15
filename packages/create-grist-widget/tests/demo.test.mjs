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
        columns: { Title: "Text", Status: "Choice", Due: "Date", Tags: "ChoiceList", Revenue: "Numeric", Costs: "Numeric", Owner: "Ref:People" },
        rows: [
          { Title: "Brief", Status: "To do", Due: "2026-12-01", Tags: ["a", "b"], Revenue: 10, Costs: 4, Owner: 1 },
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
    expect(() => checkDemo(null)).toThrow(/GristWidgetDemo/)
    expect(() => checkDemo({ tables: { tasks: { columns: {}, rows: [] } } })).toThrow(/table id/)
    expect(() => checkDemo({ tables: { T: { columns: { A: "Ref:Nope" }, rows: [] } } })).toThrow(/Grist type/)
    expect(() => checkDemo({ tables: { T: { columns: { A: "Text" }, rows: [] } }, table: "U" })).toThrow(/isn't one of its tables/)
  })
})
