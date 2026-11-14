// upgrade's codemods: the deprecated grist-widget-sdk names a widget's own
// code uses, rewritten where the meaning is the same and reported (file and
// line) where it isn't. Each rewrite is checked to be idempotent.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { migrateSource, MOVED_ACTIONS, runCodemods } from "../src/codemods.mjs"

const migrate = (source) => {
  const once = migrateSource(source)
  expect(migrateSource(once.text).text, "a second run changes nothing").toBe(once.text)
  return once
}

describe("migrateSource", () => {
  it("leaves a file that doesn't import grist-widget-sdk alone", () => {
    const source = `const w = { isReady: true }\nw.isReady && fetchTable(x)\n`
    expect(migrate(source)).toEqual({ text: source, changes: [], manual: [] })
  })

  it("renames useGristContext, generics and alias included, without a duplicate import", () => {
    const { text, changes } = migrate(
      `import { useGrist, useGristContext, type UseGristResult } from "grist-widget-sdk"\nconst w = useGristContext<Row>()\n`
    )
    expect(text).toBe(`import { useGrist, type UseGristResult } from "grist-widget-sdk"\nconst w = useGrist<Row>()\n`)
    expect(changes).toEqual(["useGristContext → useGrist"])
    expect(migrate(`import { useGristContext as useG } from "grist-widget-sdk"\nuseG()\n`).text).toBe(
      `import { useGrist as useG } from "grist-widget-sdk"\nuseG()\n`
    )
  })

  it("moves the user actions to grist-widget-sdk/actions, keeping the rest of the import", () => {
    const { text } = migrate(
      [
        "import {",
        "  gristAddColumnAction,",
        "  gristRenameColumnAction as rename,",
        "  useGrist,",
        "  type GristUserActionTuple,",
        '} from "grist-widget-sdk"',
        "",
        'w.applyActions([gristAddColumnAction("T", "A", {}), rename("T", "A", "B")])',
        "",
      ].join("\n")
    )
    expect(text).toBe(
      [
        "import {",
        "  useGrist,",
        "  type GristUserActionTuple,",
        '} from "grist-widget-sdk"',
        'import { gristAddColumnAction, gristRenameColumnAction as rename } from "grist-widget-sdk/actions"',
        "",
        'w.applyActions([gristAddColumnAction("T", "A", {}), rename("T", "A", "B")])',
        "",
      ].join("\n")
    )
  })

  it("replaces an import that only held user actions, and merges into an existing actions import", () => {
    expect(migrate(`import { gristRemoveColumnAction } from "grist-widget-sdk"\nx\n`).text).toBe(
      `import { gristRemoveColumnAction } from "grist-widget-sdk/actions"\nx\n`
    )
    expect(
      migrate(
        `import { gristAddColumnAction, useGrist } from "grist-widget-sdk"\nimport { gristRenameColumnAction } from "grist-widget-sdk/actions"\n`
      ).text
    ).toBe(`import { useGrist } from "grist-widget-sdk"\nimport { gristRenameColumnAction, gristAddColumnAction } from "grist-widget-sdk/actions"\n`)
  })

  it("rewrites isReady on a member, negated or optional, and reports what it can't", () => {
    const { text, manual } = migrate(
      [
        'import { useGrist } from "grist-widget-sdk"',
        "const a = w.isReady && !w.isReady",
        "const b = props.w?.isReady ? 1 : 0",
        "const c = !!w.isReady",
        "const { isReady } = w",
        "// once isReady flips (a comment is not reported)",
      ].join("\n")
    )
    expect(text.split("\n").slice(1, 4)).toEqual([
      'const a = w.status === "ready" && w.status !== "ready"',
      'const b = props.w?.status === "ready" ? 1 : 0',
      "const c = !!w.isReady",
    ])
    expect(manual.map((m) => [m.line, m.name])).toEqual([
      [4, "isReady"],
      [5, "isReady"],
    ])
  })

  it("rewrites the three readers to fetchRows, columns where they gave columns", () => {
    const { text, manual } = migrate(
      [
        'import { tableDataToRows, useGrist } from "grist-widget-sdk"',
        "const { fetchSelectedTable, fetchTableRows, fetchTable } = w",
        "const rows = tableDataToRows(await fetchSelectedTable())",
        'const t = await fetchTableRows<Row>("T", { order: "id" })',
        "const c = await w.fetchTable(tableId)",
        "useEffect(() => {}, [fetchSelectedTable, fetchTableRows, fetchTable])",
      ].join("\n")
    )
    expect(text.split("\n").slice(1)).toEqual([
      "const { fetchRows } = w",
      "const rows = tableDataToRows(await fetchRows({ columnar: true }))",
      'const t = await fetchRows<Row>("T", { order: "id" })',
      "const c = await w.fetchRows(tableId, { columnar: true })",
      "useEffect(() => {}, [fetchRows])",
    ])
    expect(manual).toEqual([])
  })

  it("leaves comments as they are", () => {
    const source = `import { useGrist } from "grist-widget-sdk"\n/** \`fetchTable\` needs full access. */\n// w.isReady once connected\n`
    expect(migrate(source)).toEqual({ text: source, changes: [], manual: [] })
  })

  it("leaves a reader called with options as it is, and reports it", () => {
    const { text, manual } = migrate(
      ['import { useGrist } from "grist-widget-sdk"', "const { fetchSelectedTable } = w", "await fetchSelectedTable({ keepEncoded: true })"].join("\n")
    )
    expect(text).toContain("fetchSelectedTable({ keepEncoded: true })")
    expect(text).toContain("const { fetchSelectedTable } = w")
    expect(manual.map((m) => [m.line, m.name])).toEqual([
      [2, "fetchSelectedTable"],
      [3, "fetchSelectedTable"],
    ])
  })

  it("reports isAvailable, whose meaning has no one-for-one replacement", () => {
    const { manual } = migrate(`import { useGrist } from "grist-widget-sdk"\nconst { isAvailable } = useGrist()\n`)
    expect(manual).toEqual([{ line: 2, name: "isAvailable", hint: expect.stringContaining("status") }])
  })

  it("reports a user action reached through a namespace import", () => {
    const { manual } = migrate(`import * as sdk from "grist-widget-sdk"\nimport { useGrist } from "grist-widget-sdk"\nsdk.gristAddTableAction("T", {})\n`)
    expect(manual).toEqual([{ line: 3, name: "gristAddTableAction", hint: expect.stringContaining("grist-widget-sdk/actions") }])
  })

  it("reports useGrist() given options and useGristSchema() given connection options (0.7)", () => {
    const { text, manual } = migrate(
      [
        'import { useGrist, useGristSchema } from "grist-widget-sdk"',
        "const a = useGrist()",
        'const b = useGrist<Row>({ requiredAccess: "full" })',
        "const c = widget.useGrist()",
        "const s = useGristSchema({",
        '  tableId: "T",',
        '  requiredAccess: "full",',
        "  allowSelectBy: true,",
        "})",
        "const t = useGristSchema({ sampleRowLimit: 2 })",
        '// useGrist({ requiredAccess: "x" })',
      ].join("\n")
    )
    expect(text).toContain('useGrist<Row>({ requiredAccess: "full" })')
    expect(manual).toEqual([
      { line: 3, name: "useGrist", hint: expect.stringContaining("defineGristWidget()") },
      { line: 5, name: "useGristSchema", hint: expect.stringContaining("declare requiredAccess, allowSelectBy with defineGristWidget()") },
    ])
  })

  it("reports renderWithGrist() without the widget's declaration, in a file importing only the testing entry (0.7)", () => {
    const { text, manual } = migrate(
      [
        'import { presets, renderWithGrist } from "grist-widget-sdk/emulator/testing"',
        "renderWithGrist(<App />)",
        "renderWithGrist(<App />, { widget, rows: [] })",
        "renderWithGrist(<App />, {",
        "  emulator: { document: presets.blank() },",
        "})",
      ].join("\n")
    )
    expect(text).toContain("renderWithGrist(<App />)")
    expect(manual.map((m) => [m.line, m.name])).toEqual([
      [2, "renderWithGrist"],
      [4, "renderWithGrist"],
    ])
    expect(manual[0].hint).toContain("renderWithGrist(<App />, { widget })")
  })

  it("knows the nine names the SDK moved", () => {
    expect(MOVED_ACTIONS).toHaveLength(9)
  })
})

describe("runCodemods", () => {
  const dirs = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })

  it("migrates the widget's files under src/, skipping the template's and node_modules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "codemods-"))
    dirs.push(dir)
    const old = `import { useGristContext } from "grist-widget-sdk"\nexport const w = () => useGristContext()\n`
    for (const file of ["src/app/App.tsx", "src/main.tsx", "src/app/node_modules/x.ts", "scripts/x.ts"]) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
      writeFileSync(path.join(dir, file), old)
    }
    const report = runCodemods(dir, { skip: ["src/main.tsx"] })
    expect(report.rewritten).toEqual([{ file: "src/app/App.tsx", changes: ["useGristContext → useGrist"] }])
    expect(readFileSync(path.join(dir, "src/app/App.tsx"), "utf8")).toContain("useGrist()")
    for (const file of ["src/main.tsx", "src/app/node_modules/x.ts", "scripts/x.ts"]) {
      expect(readFileSync(path.join(dir, file), "utf8")).toBe(old)
    }
    expect(runCodemods(dir, { skip: ["src/main.tsx"] }).rewritten).toEqual([])
  })
})
