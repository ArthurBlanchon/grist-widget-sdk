import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { listWidgets } from "./check-widgets.mjs"
import { allLabels, AREA_LABELS, KIND_LABELS, widgetLabels } from "./labels.mjs"

test("a widget:<slug> label per catalog widget, its title as description", () => {
  const dir = mkdtempSync(join(tmpdir(), "widgets-"))
  for (const [slug, title] of [["kanban-board", "Kanban board"], ["map", "Map"]]) {
    mkdirSync(join(dir, slug))
    writeFileSync(join(dir, slug, "SPEC.md"), `---\nslug: ${slug}\ntitle: ${title}\n---\n# ${title}\n`)
  }
  mkdirSync(join(dir, "_shared"))
  try {
    assert.deepEqual(
      widgetLabels(dir).map((l) => [l.name, l.description]),
      [["widget:kanban-board", "The Kanban board widget"], ["widget:map", "The Map widget"]],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the labels the issue forms set exist, and every label is valid for GitHub", () => {
  const names = allLabels().map((l) => l.name)
  for (const form of ["bug", "widget-request", "improvement", "triage", "area:catalog", "area:sdk"]) assert.ok(names.includes(form), form)
  assert.equal(new Set(names).size, names.length)
  for (const l of allLabels()) {
    assert.match(l.color, /^[0-9a-f]{6}$/)
    assert.ok(l.name.length <= 50 && l.description.length <= 100, l.name)
  }
  // Every catalog widget has its label, and the kinds and areas are all there.
  for (const slug of listWidgets()) assert.ok(names.includes(`widget:${slug}`), slug)
  for (const l of [...KIND_LABELS, ...AREA_LABELS]) assert.ok(names.includes(l.name), l.name)
})

test("every label an issue form sets is one the labels workflow creates", async () => {
  const { readdirSync, readFileSync } = await import("node:fs")
  const forms = new URL("../../.github/ISSUE_TEMPLATE/", import.meta.url)
  const names = new Set(allLabels().map((l) => l.name))
  const files = readdirSync(forms).filter((f) => f.endsWith(".yml") && f !== "config.yml")
  assert.ok(files.length >= 4, "the four forms")
  for (const f of files) {
    const line = /^labels:\s*\[(.*)\]\s*$/m.exec(readFileSync(new URL(f, forms), "utf8"))
    assert.ok(line, `${f}: a labels: [...] line`)
    for (const label of line[1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""))) assert.ok(names.has(label), `${f}: ${label}`)
  }
  assert.match(readFileSync(new URL("config.yml", forms), "utf8"), /^blank_issues_enabled: false$/m)
})
