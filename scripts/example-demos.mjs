#!/usr/bin/env node
// The examples' demo documents, served by the site at /examples/<id>/demo/
// (scripts/build-site.mjs): each example in a real Grist, from static files.
//
//   node scripts/example-demos.mjs build   regenerate them (needs Docker)
//   node scripts/example-demos.mjs check   fail if one is missing or stale
//
// They are committed (examples/_demos/<id>.grist) because the site is also
// built by Cloudflare Pages, where there is no Docker. Each is generated from
// the example's entry in widgets.json, like `create-grist-widget demo --save`
// does for a widget; examples/_demos/index.json records a hash of what it
// was generated from, so `check` (CI) knows when an example's columns,
// access or title changed and its document must be regenerated.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { DEMO_URL_PLACEHOLDER } from "../packages/create-grist-widget/src/demo-page.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const DEMOS_DIR = join(repoRoot, "examples/_demos")
const INDEX = join(DEMOS_DIR, "index.json")

/** What an example's demo document is generated from. */
export function demoInput(entry) {
  return { title: entry.title, requiredAccess: entry.requiredAccess, columns: entry.columns, placeholder: DEMO_URL_PLACEHOLDER }
}

export const demoHash = (entry) => createHash("sha256").update(JSON.stringify(demoInput(entry))).digest("hex").slice(0, 16)

/** Problems with the committed demos for `widgets`, or [] when they are current. */
export function staleDemos(widgets, index, exists = (id) => existsSync(join(DEMOS_DIR, `${id}.grist`))) {
  const problems = []
  for (const w of widgets) {
    if (!exists(w.id)) problems.push(`${w.id}: no examples/_demos/${w.id}.grist`)
    else if (index[w.id] !== demoHash(w)) problems.push(`${w.id}: generated from different columns, access or title`)
  }
  for (const id of Object.keys(index)) if (!widgets.some((w) => w.id === id)) problems.push(`${id}: no such example any more`)
  return problems
}

const readWidgets = () => JSON.parse(readFileSync(join(repoRoot, "widgets.json"), "utf8"))
const readIndex = () => (existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : {})

async function build() {
  const { createDemoDocument, withLocalGrist } = await import("../packages/create-grist-widget/src/demo.mjs")
  const widgets = readWidgets()
  mkdirSync(DEMOS_DIR, { recursive: true })
  const index = {}
  await withLocalGrist(async (grist) => {
    for (const w of widgets) {
      const options = { requiredAccess: w.requiredAccess, columns: w.columns }
      writeFileSync(join(DEMOS_DIR, `${w.id}.grist`), await createDemoDocument({ ...grist, options, name: w.title }))
      index[w.id] = demoHash(w)
      console.log(`example-demos: ${w.id}`)
    }
  }, { gristPort: 8693, container: "grist-widget-example-demos" })
  writeFileSync(INDEX, `${JSON.stringify(index, null, 2)}\n`)
  console.log(`example-demos: wrote ${widgets.length} documents to examples/_demos/`)
}

function check() {
  const problems = staleDemos(readWidgets(), readIndex())
  if (problems.length) {
    console.error(`example-demos: ${problems.length} demo document(s) to regenerate:\n${problems.map((p) => `  - ${p}`).join("\n")}`)
    console.error("Run `node scripts/example-demos.mjs build` (needs Docker) and commit examples/_demos/.")
    process.exit(1)
  }
  console.log("example-demos: every example's demo document is current")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2]
  if (cmd === "build") await build()
  else if (cmd === "check") check()
  else {
    console.error("Usage: node scripts/example-demos.mjs build|check")
    process.exit(2)
  }
}
