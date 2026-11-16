#!/usr/bin/env node
// The repository's issue labels, from the catalog (plan 0.8, M5 item 14):
// a `widget:<slug>` per catalog widget, the `area:*` labels, and the kinds
// the issue forms set. `node scripts/widgets/labels.mjs` prints them as
// JSON; `--sync` creates or updates each with `gh label create --force`
// (the labels workflow runs it on main). A label is never deleted here: an
// issue may still carry one of a retired widget.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { listWidgets, parseFrontMatter, WIDGETS_DIR } from "./check-widgets.mjs"

/** The kinds an issue form sets, and the triage state. */
export const KIND_LABELS = [
  { name: "bug", color: "d73a4a", description: "Something doesn't work as it should" },
  { name: "widget-request", color: "0e8a16", description: "A widget the catalog doesn't have yet" },
  { name: "improvement", color: "a2eeef", description: "A change to something that works" },
  { name: "triage", color: "fbca04", description: "New: to be labelled, reproduced and given its criteria" },
]

/** The parts of the repository an issue can be about. */
export const AREA_LABELS = [
  { name: "area:catalog", description: "A catalog widget (widgets/)" },
  { name: "area:sdk", description: "grist-widget-sdk (packages/core)" },
  { name: "area:cli", description: "create-grist-widget (packages/create-grist-widget)" },
  { name: "area:template", description: "The widget template" },
  { name: "area:docs", description: "The docs site (gristwidgets.com/docs)" },
  { name: "area:ci", description: "CI, releases and deploys" },
].map((l) => ({ ...l, color: "c5def5" }))

const WIDGET_COLOR = "bfd4f2"

/** A `widget:<slug>` label per catalog widget, its title as description. */
export function widgetLabels(dir = WIDGETS_DIR) {
  return listWidgets(dir).map((slug) => {
    const spec = join(dir, slug, "SPEC.md")
    const title = existsSync(spec) ? parseFrontMatter(readFileSync(spec, "utf8")).data?.title : null
    return { name: `widget:${slug}`, color: WIDGET_COLOR, description: `The ${title ?? slug} widget`.slice(0, 100) }
  })
}

/** Every label the repository should have. */
export const allLabels = (dir = WIDGETS_DIR) => [...KIND_LABELS, ...AREA_LABELS, ...widgetLabels(dir)]

function main() {
  const labels = allLabels()
  if (!process.argv.includes("--sync")) {
    console.log(JSON.stringify(labels, null, 2))
    return
  }
  for (const l of labels) {
    execFileSync("gh", ["label", "create", l.name, "--color", l.color, "--description", l.description, "--force"], { stdio: "inherit" })
  }
  console.log(`labels: ${labels.length} created or updated`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
