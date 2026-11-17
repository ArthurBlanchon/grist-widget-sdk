#!/usr/bin/env node
// Every public runtime name of grist-widget-sdk is used somewhere real: in a
// catalog widget's code (widgets/*/src, widgets/_shared) or in a docs
// snippet that compiles (a ```tsx or ```ts block not marked no-check, which
// packages/core/tests/docs/ type-checks). A name nothing uses has no proof
// it works the way its docs say, and no reader learns it: give it a snippet
// on its docs page, or remove it from the public API (plan to 0.8.0, M7;
// examples/ no longer counts).
//
// Types are left out: they are exercised through the functions that take
// and return them. Names re-exported from another package (Testing
// Library's) are that package's.
//
//   node scripts/ci/api-coverage.mjs

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

/** Names on their way out, each with why it may go unused. A new one is a change to what CI runs: the maintainer's go. */
export const ALLOWED = {
  useWidgetMetadata: "deprecated: mountGristWidget() sets the page's metadata; removed with the reference widgets (M7)",
}

const RUNTIME_KINDS = new Set(["function", "const", "class", "enum"])

function files(dir, keep) {
  const out = []
  let names
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...files(path, keep))
    else if (keep(name)) out.push(path)
  }
  return out
}

/** The code a name must appear in: the catalog's sources, and the docs' compiled snippets. */
export function corpus(root = ROOT) {
  const code = (name) => /\.(tsx?|mjs|js)$/.test(name)
  const widgets = files(join(root, "widgets"), code)
    .filter((p) => relative(join(root, "widgets"), p).split("/")[1] === "src" || relative(root, p).startsWith("widgets/_shared/"))
    .map((p) => readFileSync(p, "utf8"))
  const snippets = files(join(root, "apps/www/content/docs"), (n) => n.endsWith(".mdx")).flatMap((p) => snippetsOf(readFileSync(p, "utf8")))
  return [...widgets, ...snippets].join("\n")
}

/** The ```tsx and ```ts blocks of a page that compile (not marked no-check). */
export function snippetsOf(mdx) {
  return [...mdx.matchAll(/```(tsx|ts)([^\n]*)\n([\s\S]*?)```/g)].filter((m) => !/\bno-check\b/.test(m[2])).map((m) => m[3])
}

/** `[entry, name]` for each public runtime name the corpus never mentions. */
export function uncovered(reference, text, allowed = ALLOWED) {
  const out = []
  for (const [entry, rows] of Object.entries(reference)) {
    for (const row of rows) {
      if (!RUNTIME_KINDS.has(row.kind) || row.name in allowed) continue
      if (!new RegExp(`\\b${row.name.replace(/[$]/g, "\\$")}\\b`).test(text)) out.push([entry, row.name])
    }
  }
  return out
}

function main() {
  const reference = JSON.parse(readFileSync(join(ROOT, "packages/core/api/reference.json"), "utf8"))
  const missing = uncovered(reference, corpus())
  for (const [entry, name] of missing) {
    console.log(`::error::${name} (${entry}) is used by no catalog widget and no compiled docs snippet: add a snippet on its docs page, or remove it from the public API`)
  }
  const total = Object.values(reference).flat().filter((r) => RUNTIME_KINDS.has(r.kind)).length
  console.log(`api-coverage: ${total - missing.length} of ${total} public runtime names used`)
  if (missing.length) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
