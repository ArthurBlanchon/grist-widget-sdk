#!/usr/bin/env node
// Grist's gallery lists the catalog (plan to 0.8.0, M2's "done when"; ADR
// 0014): a real Grist (Docker, GRIST_IMAGE) started with the catalog's list
// as a plugin, the way the docs tell an administrator to add it
// (apps/www/content/docs/registry), and asked for its widgets
// (GET /api/widgets, what its gallery reads). It passes when every id of the
// list is there, at the list's URL, and Grist Labs' own widgets are still
// there: the plugin adds to their list, it doesn't replace it.
//
//   node scripts/widgets/gallery-check.mjs [--list <url or file>]
//
// The list defaults to the one gristwidgets.com serves.

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { apiKey, GRIST_IMAGE } from "../../packages/create-grist-widget/src/grist-local.mjs"

export const DEFAULT_LIST = "https://gristwidgets.com/widgets/grist-widgets.json"
const CONTAINER = "grist-widgets-gallery-check"
const PORT = 8496

/** The plugin folder the docs describe: manifest.yml and the list as widgets.json. */
export function pluginFiles(list) {
  return {
    "manifest.yml": "name: grist-widget-sdk catalog\ncomponents:\n  widgets: widgets.json\n",
    "widgets.json": `${JSON.stringify(list, null, 2)}\n`,
  }
}

/** What differs between the catalog's list and what Grist serves: one line each, empty when it lists them all. */
export function galleryProblems(list, served) {
  const byId = new Map(served.map((w) => [w.widgetId, w]))
  const problems = []
  for (const w of list) {
    const got = byId.get(w.widgetId)
    if (!got) problems.push(`${w.widgetId}: not in Grist's list`)
    else if (got.url !== w.url) problems.push(`${w.widgetId}: Grist has ${got.url}, the list ${w.url}`)
    else if (Boolean(got.published) !== Boolean(w.published)) problems.push(`${w.widgetId}: published is ${got.published}, the list says ${w.published}`)
  }
  if (!served.some((w) => String(w.widgetId).startsWith("@gristlabs/"))) {
    problems.push("Grist Labs' own widgets are gone: the plugin replaced their list instead of adding to it")
  }
  return problems
}

async function readList(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`${source}: ${res.status}`)
    return res.json()
  }
  return JSON.parse(readFileSync(source, "utf8"))
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`${url} didn't answer in ${seconds} s`)
}

async function main(argv) {
  const i = argv.indexOf("--list")
  const source = i === -1 ? DEFAULT_LIST : argv[i + 1]
  const list = await readList(source)
  if (!Array.isArray(list) || !list.length) throw new Error(`${source}: no widgets`)

  const root = mkdtempSync(join(tmpdir(), "grist-gallery-"))
  const plugin = join(root, "plugins", "grist-widgets")
  mkdirSync(plugin, { recursive: true })
  for (const [name, text] of Object.entries(pluginFiles(list))) writeFileSync(join(plugin, name), text)

  const url = `http://localhost:${PORT}`
  const docker = (args) => execFileSync("docker", args, { stdio: ["ignore", "pipe", "inherit"] })
  try {
    docker(["rm", "-f", CONTAINER])
  } catch {
    // none running
  }
  try {
    docker([
      "run", "-d", "--name", CONTAINER, "-p", `127.0.0.1:${PORT}:8484`,
      "-v", `${root}:/grist-user:ro`,
      "-e", "GRIST_USER_ROOT=/grist-user",
      "-e", "GRIST_DEFAULT_EMAIL=you@example.com",
      "-e", "GRIST_SINGLE_ORG=docs",
      "-e", `APP_HOME_URL=${url}`,
      GRIST_IMAGE,
    ])
    await waitFor(`${url}/status`, 180)
    const key = await apiKey(url)
    const res = await fetch(`${url}/api/widgets`, { headers: { Authorization: `Bearer ${key}` } })
    if (!res.ok) throw new Error(`/api/widgets: ${res.status} ${await res.text()}`)
    const served = await res.json()
    const problems = galleryProblems(list, served)
    console.log(`Grist (${GRIST_IMAGE}) lists ${served.length} widgets; the catalog's list has ${list.length}.`)
    if (problems.length) {
      for (const p of problems) console.error(`  - ${p}`)
      process.exit(1)
    }
    console.log("✓ every catalog id is in Grist's gallery, next to Grist Labs' widgets")
  } finally {
    try {
      docker(["rm", "-f", CONTAINER])
    } catch {
      // already gone
    }
    rmSync(root, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
}
