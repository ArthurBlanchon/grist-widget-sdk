import assert from "node:assert/strict"
import { test } from "node:test"

import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { batches, BATCH_SIZE, changedJobs, listSlugs, RULES, touchedWidgets } from "./changes.mjs"

const none = Object.fromEntries(Object.keys(RULES).map((k) => [k, false]))
const all = Object.fromEntries(Object.keys(RULES).map((k) => [k, true]))

test("docs-only changes run no job (the gate still passes)", () => {
  assert.deepEqual(changedJobs(["TODO.md", "docs/planning/x.md", "README.md"]), none)
})

test("a docs page compiles its snippets: the core job runs, with the site's lint", () => {
  assert.deepEqual(changedJobs(["apps/www/content/docs/sdk/api/helpers.mdx"]), { ...none, core: true, lint: true })
  assert.equal(changedJobs(["scripts/extract-doc-snippets.mjs"]).core, true)
})

test("an SDK change runs its tests, the smokes, the real widgets and the catalog", () => {
  const jobs = changedJobs(["packages/core/src/sdk/index.ts"])
  // The site too: its type tables read the SDK's source.
  assert.deepEqual(jobs, { ...none, core: true, lint: true, external_install: true, create_widget: true, real_widgets: true, size: true, widgets: true })
})

test("a catalog widget's spec or package.json builds the site too: its catalog page reads them", () => {
  assert.deepEqual(changedJobs(["widgets/map/SPEC.md"]), { ...none, lint: true, widgets: true })
  assert.deepEqual(changedJobs(["widgets/map/package.json"]), { ...none, lint: true, widgets: true })
  assert.deepEqual(changedJobs(["widgets/map/CHANGELOG.md"]), { ...none, lint: true, widgets: true })
  assert.equal(changedJobs(["scripts/widgets/catalog.mjs"]).lint, true)
  assert.equal(changedJobs(["scripts/widgets/check-widgets.mjs"]).lint, true)
})

test("everything the site reads from outside apps/www builds it: type tables and imports", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url))
  const www = join(root, "apps/www")
  const files = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      ["node_modules", ".next", "out", ".generated", ".source"].includes(e.name) ? [] : e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]
    )
  const read = []
  for (const file of files(www)) {
    const text = readFileSync(file, "utf8")
    // <AutoTypeTable path="../../packages/..."> resolves from apps/www; an import from its own file.
    if (file.endsWith(".mdx")) for (const [, p] of text.matchAll(/path="(\.\.\/[^"]+)"/g)) read.push(resolve(www, p))
    if (/\.(tsx?|mjs)$/.test(file)) for (const [, p] of text.matchAll(/from ["']((?:\.\.\/)+[^"']+)["']/g)) read.push(resolve(dirname(file), p))
  }
  const outside = [...new Set(read.map((p) => relative(root, p)).filter((p) => !p.startsWith("apps/www/")))]
  assert.ok(outside.length > 10, `found ${outside.length} files`)
  for (const file of outside) assert.equal(changedJobs([file]).lint, true, file)
})

test("a catalog widget's change runs the widgets job only, for that widget", () => {
  assert.deepEqual(changedJobs(["widgets/kanban-board/src/app/App.tsx"]), { ...none, widgets: true })
  assert.deepEqual(touchedWidgets(["widgets/kanban-board/src/app/App.tsx", "widgets/map/SPEC.md"]), ["kanban-board", "map"])
})

test("what every widget builds on runs them all; widgets/ files outside a widget run none", () => {
  const slugs = listSlugs()
  assert.ok(slugs.length >= 16 && !slugs.includes("_shared"))
  for (const file of ["widgets/_shared/ui/button.tsx", "packages/core/src/sdk/index.ts", "pnpm-lock.yaml", "package.json", "scripts/real-widgets/e2e-grist.mjs", ".github/workflows/ci.yml"]) {
    assert.deepEqual(touchedWidgets([file]), slugs, file)
  }
  assert.deepEqual(touchedWidgets(null), slugs)
  assert.deepEqual(touchedWidgets(["widgets/AGENTS.md"]), [])
  assert.equal(changedJobs(["widgets/AGENTS.md"]).widgets, false)
  // A folder named like a widget's prefix isn't that widget.
  assert.deepEqual(touchedWidgets(["widgets/mapper/x.ts"], ["map"]), [])
})

test("batches: as few as it takes, at most BATCH_SIZE each, balanced, nothing lost", () => {
  assert.deepEqual(batches([]), [])
  assert.deepEqual(batches(["a"]), [["a"]])
  for (const n of [1, 8, 9, 16, 17, 40]) {
    const list = Array.from({ length: n }, (_, i) => `w${i}`)
    const out = batches(list)
    assert.equal(out.length, Math.ceil(n / BATCH_SIZE), `${n}`)
    assert.ok(out.every((b) => b.length <= BATCH_SIZE))
    const sizes = out.map((b) => b.length)
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${n}: ${sizes}`)
    assert.deepEqual(out.flat().sort(), [...list].sort())
  }
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
  assert.equal(changedJobs(["packages/create-grist-widget/src/deploy.mjs.bak"]).template_deploy, false)
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

test("a widgets/ folder that isn't a valid widget is listed, so its batch fails on it", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "widgets-"))
  for (const name of ["ok", "My_Widget", "half-made", "_shared", ".cache"]) mkdirSync(join(dir, name))
  writeFileSync(join(dir, "ok", "package.json"), "{}")
  const slugs = listSlugs(dir)
  assert.deepEqual(slugs, ["My_Widget", "half-made", "ok"])
  assert.deepEqual(touchedWidgets(["widgets/half-made/SPEC.md"], slugs), ["half-made"])
  // A deleted widget's folder is gone: nothing left to check.
  assert.deepEqual(touchedWidgets(["widgets/removed/SPEC.md"], slugs), [])
})
