import assert from "node:assert/strict"
import { test } from "node:test"

import { changedJobs, RULES } from "./changes.mjs"

const none = Object.fromEntries(Object.keys(RULES).map((k) => [k, false]))
const all = Object.fromEntries(Object.keys(RULES).map((k) => [k, true]))

test("docs-only changes run no job (the gate still passes)", () => {
  assert.deepEqual(changedJobs(["TODO.md", "docs/planning/x.md", "README.md"]), none)
})

test("an SDK change runs its tests, the smokes, the real widgets and the catalog", () => {
  const jobs = changedJobs(["packages/core/src/sdk/index.ts"])
  assert.deepEqual(jobs, { ...none, core: true, external_install: true, create_widget: true, real_widgets: true, size: true, widgets: true })
})

test("a catalog widget's change runs the widgets job only", () => {
  assert.deepEqual(changedJobs(["widgets/kanban-board/src/app/App.tsx"]), { ...none, widgets: true })
})

test("the template deploy smoke runs only for the deploy's files", () => {
  assert.equal(changedJobs(["packages/create-grist-widget/src/upgrade.mjs"]).template_deploy, false)
  assert.equal(changedJobs(["packages/create-grist-widget/src/deploy.mjs"]).template_deploy, true)
})

test("a workflow change, a CI-script change or an unknown diff runs everything", () => {
  assert.deepEqual(changedJobs([".github/workflows/release.yml"]), all)
  assert.deepEqual(changedJobs(["scripts/ci/changes.mjs"]), all)
  assert.deepEqual(changedJobs(null), all)
})

test("a file rule matches that file only, not a prefix of it", () => {
  assert.equal(changedJobs(["scripts/compose-example.mjs.bak"]).create_widget, false)
})

test("ci.yml: gate needs every job, and changes outputs every rule", async () => {
  const { readFileSync } = await import("node:fs")
  const yml = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8")
  const jobs = [...yml.slice(yml.indexOf("\njobs:")).matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)].map((m) => m[1])
  const needs = /^ {4}needs: \[(.*)\]$/m.exec(yml.slice(yml.indexOf("\n  gate:")))[1].split(",").map((s) => s.trim())
  assert.deepEqual([...needs].sort(), jobs.filter((j) => j !== "gate").sort())
  for (const rule of Object.keys(RULES)) {
    assert.match(yml, new RegExp(`^ {6}${rule}: \\$\\{\\{ steps\\.diff\\.outputs\\.${rule} \\}\\}$`, "m"))
    assert.match(yml, new RegExp(`needs\\.changes\\.outputs\\.${rule} == 'true'`))
  }
})
