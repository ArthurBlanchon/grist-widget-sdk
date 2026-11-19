#!/usr/bin/env node
// Every public runtime name of grist-widget-sdk is used somewhere real: in a
// catalog widget's code (widgets/*/src, widgets/_shared) or in a docs
// snippet that compiles. A name nothing uses has no proof it works the way
// its docs say, and no reader learns it: give it a snippet on its docs page,
// or remove it from the public API (plan to 0.8.0, M7; examples/ no longer
// counts).
//
// "Used" means imported from the entry that exports it
// (`import { name } from "grist-widget-sdk/<entry>"`), comments aside: a
// mention in a comment or a string, or a local name that happens to match,
// doesn't count. A docs snippet is read the way packages/core/tests/docs/
// compiles it (scripts/extract-doc-snippets.mjs): its ```tsx blocks not
// marked no-check, with the imports the harness supplies.
//
// Types and names re-exported from another package (Testing Library's) are
// left out: types are exercised through the functions that take and return
// them, and re-exports are that package's.
//
//   node scripts/ci/api-coverage.mjs

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { extractBlocks, renderSnippetFile } from "../extract-doc-snippets.mjs"

const ROOT = fileURLToPath(new URL("../..", import.meta.url))

/** Names on their way out, each with why it may go unused. A new one is a change to what CI runs: the maintainer's go. */
export const ALLOWED = {
  useWidgetMetadata: "deprecated: mountGristWidget() sets the page's metadata; removed with the reference widgets (M7)",
}

/** Kinds that aren't checked: everything else (function, const, class, enum, namespace…) is a runtime name. */
const UNCHECKED_KINDS = new Set(["type", "re-export"])

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

/** The docs' compiled snippets, as the harness writes them (supplied imports included). */
export function snippetsOf(mdx) {
  return extractBlocks(mdx)
    .filter(({ info }) => info !== "no-check")
    .map(({ code }) => renderSnippetFile(code))
}

/** The code a name must be imported in: the catalog's sources, and the docs' compiled snippets. */
export function corpus(root = ROOT) {
  const code = (name) => /\.(tsx?|mjs|js)$/.test(name)
  const widgets = files(join(root, "widgets"), code)
    .filter((p) => relative(join(root, "widgets"), p).split("/")[1] === "src" || relative(root, p).startsWith("widgets/_shared/"))
    .map((p) => readFileSync(p, "utf8"))
  const snippets = files(join(root, "apps/www/content/docs"), (n) => n.endsWith(".mdx")).flatMap((p) => snippetsOf(readFileSync(p, "utf8")))
  return [...widgets, ...snippets]
}

/** The source without its comments (a `//` inside a string such as a URL is kept). */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`\\])\/\/.*$/, "$1"))
    .join("\n")
}

const IMPORT = /\b(?:import|export)\s+(?:type\s+)?(?:[\w$]+\s*,\s*)?(?:\{([^}]*)\}|\*\s+as\s+([\w$]+))\s*from\s*["'](grist-widget-sdk(?:\/[\w/-]+)?)["']/g

/** entry → names imported from it (value imports only), over every file of the corpus. */
export function usesOf(sources) {
  const uses = new Map()
  const add = (entry, name) => {
    if (!uses.has(entry)) uses.set(entry, new Set())
    uses.get(entry).add(name)
  }
  for (const source of sources) {
    const text = stripComments(source)
    for (const [, list, namespace, entry] of text.matchAll(IMPORT)) {
      if (namespace) {
        for (const [, name] of text.matchAll(new RegExp(`\\b${namespace.replace(/\$/g, "\\$")}\\.([\\w$]+)`, "g"))) add(entry, name)
        continue
      }
      for (const spec of list.split(",")) {
        const s = spec.trim()
        if (!s || s.startsWith("type ")) continue
        add(entry, s.split(/\s+as\s+/)[0].trim())
      }
    }
  }
  return uses
}

const checked = (row) => !UNCHECKED_KINDS.has(row.kind)

/** `[entry, name]` for each public runtime name no file of the corpus imports from its entry. */
export function uncovered(reference, uses, allowed = ALLOWED) {
  const out = []
  for (const [entry, rows] of Object.entries(reference)) {
    for (const row of rows) {
      if (!checked(row) || Object.hasOwn(allowed, row.name)) continue
      if (!uses.get(entry)?.has(row.name)) out.push([entry, row.name])
    }
  }
  return out
}

/** Allowed names that no longer need to be: no longer exported, or now used. */
export function staleAllowed(reference, uses, allowed = ALLOWED) {
  return Object.keys(allowed).filter((name) => {
    const entries = Object.entries(reference).filter(([, rows]) => rows.some((r) => r.name === name && checked(r)))
    return entries.length === 0 || entries.every(([entry]) => uses.get(entry)?.has(name))
  })
}

function main() {
  const reference = JSON.parse(readFileSync(join(ROOT, "packages/core/api/reference.json"), "utf8"))
  const uses = usesOf(corpus())
  const missing = uncovered(reference, uses)
  for (const [entry, name] of missing) {
    console.log(`::error::${name} (${entry}) is imported by no catalog widget and no compiled docs snippet: add a snippet on its docs page, or remove it from the public API`)
  }
  const stale = staleAllowed(reference, uses)
  for (const name of stale) console.log(`::error::${name} is in ALLOWED but is no longer exported, or is now used: remove it from ALLOWED`)
  const total = Object.values(reference).flat().filter(checked).length
  console.log(`api-coverage: ${total - missing.length} of ${total} public runtime names used`)
  if (missing.length || stale.length) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
