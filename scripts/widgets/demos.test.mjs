import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { demoHash, demosToMake } from "./demos.mjs"

const kanban = { slug: "kanban-board", title: "Kanban board", options: { requiredAccess: "full", columns: [{ name: "Title" }] } }

test("a demo is made when missing, or when the title, access or columns changed", () => {
  const dist = mkdtempSync(join(tmpdir(), "demos-"))
  assert.deepEqual(demosToMake([kanban], dist).map((w) => w.slug), ["kanban-board"])
  mkdirSync(join(dist, "kanban-board", "demo"), { recursive: true })
  writeFileSync(join(dist, "kanban-board", "demo", "demo.grist"), "")
  writeFileSync(join(dist, "kanban-board", "demo", "demo.json"), JSON.stringify({ hash: demoHash(kanban) }))
  assert.deepEqual(demosToMake([kanban], dist), [])
  const changed = { ...kanban, options: { ...kanban.options, columns: [{ name: "Title" }, { name: "Status" }] } }
  assert.deepEqual(demosToMake([changed], dist).map((w) => w.slug), ["kanban-board"])
})
