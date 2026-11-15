#!/usr/bin/env node
// Grist's gallery lists the catalog (plan to 0.8.0, M2's "done when"; ADR
// 0014): a real Grist (Docker, GRIST_IMAGE) started with the catalog's list
// as a plugin, the way the docs tell an administrator to add it
// (apps/www/content/docs/registry), and asked for its widgets
// (GET /api/widgets, what its gallery reads). It passes when:
// - every id the repository's catalog expects (each beta or stable widget's
//   declared major, scripts/widgets/catalog.mjs) is in the list the site
//   serves, so a failed deploy or a dropped id shows;
// - every id of that list is in Grist's, at the list's URL and published
//   flag;
// - Grist Labs' own widgets are still listed: their list, which Grist reads
//   from the network, sits next to the plugin's (a canary on that fetch too).
//
//   node scripts/widgets/gallery-check.mjs [--list <url or file>]
//
// The list defaults to the one gristwidgets.com serves.

import { execFileSync } from "node:child_process"
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { apiKey, GRIST_IMAGE, waitFor } from "../../packages/create-grist-widget/src/grist-local.mjs"
import { gristWidgetId, readCatalog } from "./catalog.mjs"

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

/** The ids the repository's catalog expects: each listed widget's declared major. */
export function expectedIds(catalog = readCatalog()) {
  return catalog.map((w) => gristWidgetId(w.slug, w.channel))
}

/**
 * What differs: an expected id missing from the site's list, or the list and
 * what Grist serves. One line each, empty when all is there.
 */
export function galleryProblems(list, served, expected = []) {
  const byId = new Map(served.map((w) => [w.widgetId, w]))
  const listed = new Set(list.map((w) => w.widgetId))
  const problems = expected.filter((id) => !listed.has(id)).map((id) => `${id}: the repository's catalog has it, the site's list doesn't`)
  for (const w of list) {
    const got = byId.get(w.widgetId)
    if (!got) problems.push(`${w.widgetId}: not in Grist's list`)
    else if (got.url !== w.url) problems.push(`${w.widgetId}: Grist has ${got.url}, the list ${w.url}`)
    else if (Boolean(got.published) !== Boolean(w.published)) problems.push(`${w.widgetId}: published is ${got.published}, the list says ${w.published}`)
  }
  if (!served.some((w) => String(w.widgetId).startsWith("@gristlabs/"))) {
    problems.push("Grist Labs' own widgets aren't listed: Grist couldn't read their list, or the plugin's took its place")
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

async function main(argv) {
  const i = argv.indexOf("--list")
  const source = i === -1 ? DEFAULT_LIST : argv[i + 1]
  if (!source) throw new Error("Usage: gallery-check.mjs [--list <url or file>]")
  const list = await readList(source)
  if (!Array.isArray(list) || !list.length) throw new Error(`${source}: no widgets`)

  const root = mkdtempSync(join(tmpdir(), "grist-gallery-"))
  // mkdtemp makes it 0700: Grist runs as its own user in the container.
  chmodSync(root, 0o755)
  const plugin = join(root, "plugins", "grist-widgets")
  mkdirSync(plugin, { recursive: true })
  for (const [name, text] of Object.entries(pluginFiles(list))) writeFileSync(join(plugin, name), text, { mode: 0o644 })
  for (const dir of [join(root, "plugins"), plugin]) chmodSync(dir, 0o755)

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
      // A fresh install is out of service, and refuses /api/* until set up
      // (grist-local.mjs's startGrist does the same).
      "-e", "GRIST_IN_SERVICE=true",
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
    const problems = galleryProblems(list, served, expectedIds())
    console.log(`Grist (${GRIST_IMAGE}) lists ${served.length} widgets; the catalog's list has ${list.length}.`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Grist's gallery\n\n${problems.length ? problems.map((p) => `- ${p}`).join("\n") : "Every catalog id is listed, next to Grist Labs' widgets."}\n`,
      )
    }
    if (problems.length) {
      for (const p of problems) console.error(`  - ${p}`)
      // Not process.exit: the container and the folder go first (finally).
      process.exitCode = 1
    } else {
      console.log("✓ every catalog id is in Grist's gallery, next to Grist Labs' widgets")
    }
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
