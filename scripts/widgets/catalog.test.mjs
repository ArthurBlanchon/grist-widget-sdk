import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { catalogEntry, columnRows, gristWidgetList, readCatalog, recentChanges, section, writeSiteCatalog } from "./catalog.mjs"
import { listWidgets } from "./check-widgets.mjs"

const SPEC = (status) => `---
slug: board
title: Board
category: visualisation
status: ${status}
access: full
---

# Board

## Job

Rows as cards, with \`Status\` as the column.

## Columns

| Column | Type | Required | Use |
| --- | --- | --- | --- |
| Title | Text | yes | the card's title |
| Status | Choice, Text | yes | the card's column |
| Value | Numeric or Int | no | summed |

## Access

\`full\`: moving a card writes its Status.

## Acceptance criteria

- **AC-1** x
`

function widgetsDir(widgets) {
  const dir = mkdtempSync(join(tmpdir(), "catalog-"))
  for (const [slug, { status, version = "1.2.0" }] of Object.entries(widgets)) {
    mkdirSync(join(dir, slug))
    writeFileSync(join(dir, slug, "SPEC.md"), SPEC(status).replace("slug: board", `slug: ${slug}`).replace("title: Board", `title: ${slug}`))
    writeFileSync(join(dir, slug, "package.json"), JSON.stringify({ name: `@grist-widgets/${slug}`, version, description: `${slug}, briefly.`, license: "MIT" }))
    writeFileSync(join(dir, slug, "CHANGELOG.md"), `# Changelog\n\n## ${version} (2026-11-15)\n\n- A fix.\n\n## 1.0.0\n\nFirst release.\n`)
  }
  return dir
}

test("a spec's sections and Columns table", () => {
  const body = SPEC("beta").split("---\n")[2]
  assert.equal(section(body, "Job"), "Rows as cards, with `Status` as the column.")
  assert.equal(section(body, "Network"), "")
  assert.deepEqual(columnRows(body), [
    { name: "Title", types: ["Text"], required: true, use: "the card's title" },
    { name: "Status", types: ["Choice", "Text"], required: true, use: "the card's column" },
    { name: "Value", types: ["Numeric", "Int"], required: false, use: "summed" },
  ])
})

test("the newest changelog entries, with their dates when headings have them", () => {
  assert.deepEqual(recentChanges("## 1.1.0 (2026-11-15)\n\n- A fix.\n\n## 1.0.0\n\nFirst.\n"), [
    { version: "1.1.0", date: "2026-11-15", text: "- A fix." },
    { version: "1.0.0", date: null, text: "First." },
  ])
  assert.equal(recentChanges("## 1.1.0\n\na\n\n## 1.0.0\n\nb\n", 1).length, 1)
})

test("an entry installs from its major's channel on gristwidgets.com, with the github.io copy beside it", () => {
  const dir = widgetsDir({ board: { status: "beta", version: "2.3.1" } })
  const entry = catalogEntry("board", join(dir, "board"))
  assert.equal(entry.channel, "v2")
  assert.equal(entry.installUrl, "https://gristwidgets.com/widgets/board/v2/")
  assert.equal(entry.alternateUrl, "https://arthurblanchon.github.io/grist-widget-sdk/widgets/board/v2/")
  assert.equal(entry.accessNote, "`full`: moving a card writes its Status.")
  assert.equal(entry.changes[0].version, "2.3.1")
})

test("drafts and retired widgets are left out, the rest sorted by title", () => {
  const dir = widgetsDir({ zeta: { status: "stable" }, alpha: { status: "beta" }, wip: { status: "draft" }, old: { status: "retired" } })
  assert.deepEqual(readCatalog(dir).map((w) => w.slug), ["alpha", "zeta"])
})

test("Grist's list points at the origin serving it", () => {
  const dir = widgetsDir({ board: { status: "beta" } })
  const [entry] = gristWidgetList(readCatalog(dir), "https://arthurblanchon.github.io/grist-widget-sdk/")
  assert.equal(entry.url, "https://arthurblanchon.github.io/grist-widget-sdk/widgets/board/v1/")
  assert.equal(entry.accessLevel, "full")
  assert.equal(entry.published, true)
  assert.equal(entry.widgetId, "@grist-widgets/board")
  assert.equal(entry.lastUpdatedAt, "2026-11-15T00:00:00.000Z")
  assert.equal(entry.gristWidgetSdk.channel, "v1")

  const out = mkdtempSync(join(tmpdir(), "site-"))
  writeSiteCatalog(out, "https://gristwidgets.com", readCatalog(dir))
  assert.equal(JSON.parse(readFileSync(join(out, "grist-widgets.json"), "utf8"))[0].url, "https://gristwidgets.com/widgets/board/v1/")
  assert.equal(JSON.parse(readFileSync(join(out, "catalog.json"), "utf8"))[0].slug, "board")
})

test("every listed catalog widget has a job, columns, an access note and a changelog", () => {
  const catalog = readCatalog()
  assert.ok(catalog.length > 0 && catalog.length <= listWidgets().length)
  for (const w of catalog) {
    assert.ok(w.job, `${w.slug}: no Job`)
    assert.ok(w.columns.length || w.columnsNote, `${w.slug}: no Columns`)
    assert.ok(w.accessNote, `${w.slug}: no Access`)
    assert.equal(w.changes[0]?.version, w.version, `${w.slug}: changelog`)
  }
})
