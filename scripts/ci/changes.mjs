// Which ci.yml jobs a change needs. Reads the changed paths (one per line)
// on stdin and prints `name=true|false` lines for $GITHUB_OUTPUT.
//
// One rule per job, in one place: before ci.yml each workflow carried its own
// path filter, and a path-filtered required check that doesn't run blocks the
// merge, so docs-only pull requests needed a bypass. Now every job is listed
// here and the `gate` job, which always runs, is the only required check.
//
// A change to a workflow or to this file runs every job: CI checks itself.
//
// The catalog widgets run as a matrix (plan to 0.8.0, M3): `widget_batches`
// lists the widgets a change touches, in balanced batches of at most
// BATCH_SIZE. A widget's own folder runs that widget; what they all build on
// (`_shared`, the SDK, the e2e harness, the lockfile, CI itself) runs them all.

import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const LOCKFILE = "pnpm-lock.yaml"
export const BATCH_SIZE = 8
const WIDGETS_DIR = fileURLToPath(new URL("../../widgets/", import.meta.url))

/** @type {Record<string, (string|RegExp)[]>} */
export const RULES = {
  // The docs' tsx snippets are compiled by the SDK's tests, and the API
  // coverage check counts them: a docs-only change must compile them too.
  core: ["packages/core/", "apps/www/content/docs/", "scripts/extract-doc-snippets.mjs", LOCKFILE],
  cli: ["packages/create-grist-widget/", LOCKFILE],
  // The site also reads the SDK's source (its type tables), its reference,
  // the CLI's help and the catalog (each widget's SPEC.md, package.json and
  // CHANGELOG.md, through catalog.mjs and the parsers it imports). A test
  // keeps this list in step with what apps/www reads.
  lint: [
    "apps/www/",
    "packages/core/src/sdk/",
    "scripts/widgets/catalog.mjs",
    "scripts/widgets/check-widgets.mjs",
    /^widgets\/[^/]+\/(SPEC\.md|package\.json|CHANGELOG\.md)$/,
    "templates/grist-widget-template-vite/",
    "packages/core/api/reference.json",
    "packages/create-grist-widget/src/help.mjs",
    LOCKFILE,
  ],
  external_install: ["packages/core/", "templates/grist-widget-template-vite/", "scripts/smoke/", LOCKFILE],
  create_widget: [
    "packages/core/",
    "packages/create-grist-widget/",
    "templates/grist-widget-template-vite/",
    "scripts/smoke/",
    LOCKFILE,
  ],
  template_deploy: [
    "packages/create-grist-widget/src/deploy.mjs",
    "packages/create-grist-widget/bin/grist-widget-deploy.mjs",
    "templates/grist-widget-template-vite/.github/workflows/deploy.yml",
    "templates/grist-widget-template-vite/package.json",
    "scripts/smoke/",
    LOCKFILE,
  ],
  real_widgets: ["packages/core/", "packages/create-grist-widget/", "scripts/real-widgets/"],
  size: ["packages/core/", "templates/grist-widget-template-vite/", LOCKFILE],
  // What every catalog widget builds on: a change here runs them all. A
  // change to one widget's folder runs that one (touchedWidgets).
  widgets: [
    "widgets/_shared/",
    "packages/core/",
    "packages/create-grist-widget/src/grist-local.mjs",
    "scripts/widgets/",
    "scripts/real-widgets/e2e-grist.mjs",
    "pnpm-workspace.yaml",
    // The root package.json defines e2e:grist, which every batch runs.
    "package.json",
    LOCKFILE,
  ],
}

const EVERYTHING = [".github/workflows/", "scripts/ci/"]

/** A rule is a folder ("x/"), a file, or a pattern for files. */
const matches = (file, rule) => (rule instanceof RegExp ? rule.test(file) : rule.endsWith("/") ? file.startsWith(rule) : file === rule)

const runsAll = (files) => files === null || files.some((f) => EVERYTHING.some((r) => matches(f, r)))

/**
 * The catalog widgets: every folder of widgets/ not starting with _ or .,
 * as check-widgets.mjs lists them. A folder that isn't a valid widget (no
 * package.json, a name that isn't a slug) is kept, so that its batch fails
 * on it rather than the change merging green.
 */
export function listSlugs(dir = WIDGETS_DIR) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort()
}

/**
 * The catalog widgets a change touches: all of them, or those whose folder
 * changed and still exists (a deleted widget has nothing left to check).
 */
export function touchedWidgets(files, slugs = listSlugs()) {
  if (runsAll(files) || files.some((f) => RULES.widgets.some((r) => matches(f, r)))) return slugs
  return slugs.filter((slug) => files.some((f) => f.startsWith(`widgets/${slug}/`)))
}

/** `list` in as few batches of at most `size` as it takes, their sizes within one of each other. */
export function batches(list, size = BATCH_SIZE) {
  const count = Math.ceil(list.length / size)
  return Array.from({ length: count }, (_, i) => list.filter((_, j) => j % count === i))
}

/** `{ job: boolean }` for a list of changed paths. `null` (unknown diff) runs every job. */
export function changedJobs(files, slugs = listSlugs()) {
  const all = runsAll(files)
  const jobs = Object.fromEntries(
    Object.entries(RULES).map(([job, rules]) => [job, all || files.some((f) => rules.some((r) => matches(f, r)))])
  )
  jobs.widgets = touchedWidgets(files, slugs).length > 0
  return jobs
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let input = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) input += chunk
  const files = process.argv.includes("--all") ? null : input.split("\n").map((l) => l.trim()).filter(Boolean)
  for (const [job, run] of Object.entries(changedJobs(files))) console.log(`${job}=${run}`)
  // Each batch is one matrix entry: its folder names, space-separated. ci.yml
  // checks each one (a slug, with a package.json) before using it.
  console.log(`widget_batches=${JSON.stringify(batches(touchedWidgets(files)).map((b) => b.join(" ")))}`)
}
