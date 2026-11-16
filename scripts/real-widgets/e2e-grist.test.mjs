// node --test "scripts/real-widgets/*.test.mjs": the pure parts of e2e-grist.mjs. The
// Grist and browser parts run in the "Real widgets" workflow.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { columnType, documentSpec, GRIST_IMAGE, sampleValue } from "./e2e-grist.mjs"

test("a declared column gets the first simple type it accepts", () => {
  assert.equal(columnType("Text,Ref,Choice"), "Text")
  assert.equal(columnType("Ref,Date"), "Date")
  assert.equal(columnType("Ref"), "Text")
  assert.equal(columnType(undefined), "Any")
  assert.equal(columnType("Attachments"), "Attachments")
})

test("sample values fit their type, and dates start today", () => {
  const now = new Date("2026-11-02T08:30:00Z")
  assert.equal(sampleValue("Date", "d", 0, now), Date.UTC(2026, 10, 2) / 1000)
  assert.equal(sampleValue("Date", "d", 1, now), Date.UTC(2026, 10, 3) / 1000)
  assert.equal(sampleValue("Numeric", "n", 1, now), 20)
  assert.equal(sampleValue("Bool", "b", 1, now), false)
  assert.deepEqual(sampleValue("ChoiceList", "c", 0, now), ["L", "Option A"])
  assert.equal(sampleValue("Attachments", "f", 0, now), null)
  assert.equal(sampleValue("Text", "Title", 0, now), "Title 1")
})

test("the document has a typed, mapped column per declared column", () => {
  const spec = documentSpec({
    requiredAccess: "full",
    columns: [
      { name: "Title", type: "Text" },
      { name: "Status", type: "Choice", optional: true },
      { name: "Tags", type: "Text", allowMultiple: true },
      "Loose",
    ],
  })
  assert.deepEqual(
    spec.columns.map((c) => [c.id, c.fields.type, c.mapped, c.allowMultiple]),
    [
      ["Title", "Text", true, false],
      ["Status", "Choice", true, false],
      ["Tags", "Text", true, true],
      ["Loose", "Any", true, false],
    ]
  )
  assert.deepEqual(JSON.parse(spec.columns[1].fields.widgetOptions).choices, ["Option A", "Option B"])
  assert.equal(spec.rows.length, 3)
  assert.equal(spec.rows[0].Title, "Title 1")
})

test("a widget declaring no columns gets one unmapped column to read", () => {
  const spec = documentSpec({ requiredAccess: "read table" })
  assert.deepEqual(spec.columns.map((c) => [c.id, c.mapped]), [["Name", false]])
})

test("Grist runs from a pinned image, never latest", () => {
  const source = readFileSync(new URL("../../packages/create-grist-widget/src/grist-local.mjs", import.meta.url), "utf8")
  assert.match(source, /"gristlabs\/grist:\d+\.\d+\.\d+"/)
  if (!process.env.GRIST_IMAGE) assert.notEqual(GRIST_IMAGE.split(":")[1], "latest")
})

test("a build with relative URLs is served under /<name>/dev/, and unknown paths fall back to index.html", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { distFile } = await import("./e2e-grist.mjs")
  const dist = mkdtempSync(join(tmpdir(), "dist-"))
  mkdirSync(join(dist, "assets"))
  writeFileSync(join(dist, "index.html"), "")
  writeFileSync(join(dist, "assets", "a.js"), "")
  assert.equal(distFile(dist, "/assets/a.js"), join(dist, "assets", "a.js"))
  assert.equal(distFile(dist, "/kanban-board/dev/assets/a.js"), join(dist, "assets", "a.js"))
  assert.equal(distFile(dist, "/kanban-board/dev/"), join(dist, "index.html"))
  assert.equal(distFile(dist, "/../../etc/passwd"), join(dist, "index.html"))
})

test("only serious and critical accessibility violations fail, and --axe/--themes parse", async () => {
  const { failingViolations, parseArgs } = await import("./e2e-grist.mjs")
  const v = [{ id: "a", impact: "minor" }, { id: "b", impact: "serious" }, { id: "c", impact: "critical" }, { id: "d", impact: "moderate" }]
  assert.deepEqual(failingViolations(v).map((x) => x.id), ["b", "c"])
  const args = parseArgs(["w", "--axe", "--themes", "--build", "--strict-console"])
  assert.equal(args.axe, true)
  assert.equal(args.themes, true)
  assert.equal(args.build, true)
  assert.equal(args.strictConsole, true)
  assert.equal(parseArgs(["w"]).strictConsole, false)
  assert.equal(parseArgs(["w", "--standard"]).standard, true)
  assert.equal(parseArgs(["w"]).standard, false)
})

test("--baseline finds the last released build, and a comparison reads as one line", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { parseArgs, releasedBuild, visualLine } = await import("./e2e-grist.mjs")
  const dist = mkdtempSync(join(tmpdir(), "widgets-dist-"))
  for (const v of ["0.1.2", "0.10.0", "0.9.1"]) {
    mkdirSync(join(dist, "map", v), { recursive: true })
    writeFileSync(join(dist, "map", v, "index.html"), "")
  }
  // A version folder without its build isn't a release.
  mkdirSync(join(dist, "map", "0.11.0"))
  assert.deepEqual(releasedBuild(dist, "map"), { version: "0.10.0", dir: join(dist, "map", "0.10.0") })
  assert.equal(releasedBuild(dist, "gantt"), null)
  assert.equal(parseArgs(["w", "--baseline", dist]).baseline, dist)
  assert.equal(parseArgs(["w"]).baseline, null)

  assert.equal(visualLine(undefined), null)
  assert.equal(visualLine({ note: "no released version to compare with" }), "no released version to compare with")
  assert.equal(
    visualLine({ version: "0.1.2", themes: [{ theme: "light", changed: 0 }, { theme: "dark", changed: 0.0347 }] }),
    "against 0.1.2: light: unchanged, dark: 3.5% of pixels changed",
  )
  assert.equal(visualLine({ version: "0.1.2", themes: [{ theme: "light", changed: 0.0004 }] }), "against 0.1.2: light: 0.04% of pixels changed")
  assert.equal(visualLine({ version: "0.1.2", themes: [{ theme: "light", changed: 1, resized: "10×10 → 10×12" }] }), "against 0.1.2: light: resized 10×10 → 10×12")
  assert.equal(visualLine({ version: "0.1.2", themes: [{ theme: "dark", note: "the released version: blank" }] }), "against 0.1.2: dark: the released version: blank")
})
