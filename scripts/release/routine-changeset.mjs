#!/usr/bin/env node
// The release train's routine changeset: one entry for the Dependabot
// updates merged since the last release that reach a published package.
// Dependabot can't write a changeset itself (scripts/check-changeset.sh lets
// its pull requests through), so whoever prepares a release runs this before
// merging the Version Packages pull request (docs/operations/releasing.md).
//
// What counts as reaching a published package:
// - create-grist-widget: any change under templates/grist-widget-template-vite/
//   (the template, its package.json and workflows ship in every scaffold);
// - grist-widget-sdk: a change to packages/core/package.json's
//   `dependencies` or `peerDependencies` (devDependencies don't ship).
//
// Usage: node scripts/release/routine-changeset.mjs [--since <ref>] [--write]
//   --since  defaults to the last create-grist-widget@* tag reachable from HEAD
//   --write  writes .changeset/routine-dependencies.md (otherwise: dry run)

import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const TEMPLATE_DIR = "templates/grist-widget-template-vite/"
export const CORE_MANIFEST = "packages/core/package.json"
export const CHANGESET_FILE = ".changeset/routine-dependencies.md"

/** The pull request numbers in squash-merge subjects ("… (#12)"), ascending, without duplicates. */
export function pullRequestNumbers(subjects) {
  const numbers = new Set()
  for (const subject of subjects) {
    const m = /\(#(\d+)\)\s*$/.exec(subject)
    if (m) numbers.add(Number(m[1]))
  }
  return [...numbers].sort((a, b) => a - b)
}

/** Whether the SDK's shipped dependencies differ between two package.json texts. */
export function shippedDependenciesChanged(beforeText, afterText) {
  const shipped = (text) => {
    const pkg = JSON.parse(text)
    return JSON.stringify([pkg.dependencies ?? {}, pkg.peerDependencies ?? {}])
  }
  return shipped(beforeText) !== shipped(afterText)
}

/** The changeset's text, or null when nothing published changed. */
export function changesetText({ template, sdk }) {
  const packages = []
  if (sdk.changed) packages.push("grist-widget-sdk")
  if (template.length > 0) packages.push("create-grist-widget")
  if (packages.length === 0) return null
  const lines = []
  if (template.length > 0) {
    lines.push(
      `The template's dependencies move up (Dependabot ${template.map((n) => `#${n}`).join(", ")}).`,
      "",
      "Existing widgets get the same updates from their own Dependabot pull requests; nothing to do by hand."
    )
  }
  if (sdk.changed) {
    if (lines.length) lines.push("")
    lines.push("grist-widget-sdk's own dependencies move up (Dependabot).")
  }
  return `---\n${packages.map((p) => `"${p}": patch`).join("\n")}\n---\n\n${lines.join("\n")}\n`
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim()
}

function main() {
  const args = process.argv.slice(2)
  const sinceAt = args.indexOf("--since")
  const since = sinceAt >= 0 ? args[sinceAt + 1] : git(["describe", "--tags", "--abbrev=0", "--match", "create-grist-widget@*", "HEAD"])
  const write = args.includes("--write")

  const dependabot = (paths) =>
    git(["log", "--format=%s", "--author=dependabot", `${since}..HEAD`, "--", ...paths])
      .split("\n")
      .filter(Boolean)
  const template = pullRequestNumbers(dependabot([TEMPLATE_DIR]))
  const sdkChanged =
    dependabot([CORE_MANIFEST]).length > 0 &&
    shippedDependenciesChanged(git(["show", `${since}:${CORE_MANIFEST}`]), git(["show", `HEAD:${CORE_MANIFEST}`]))

  const text = changesetText({ template, sdk: { changed: sdkChanged } })
  console.log(`Since ${since}: Dependabot changes to the template: ${template.length ? template.map((n) => `#${n}`).join(", ") : "none"}; to the SDK's shipped dependencies: ${sdkChanged ? "yes" : "no"}.`)
  if (!text) {
    console.log("No routine changeset needed.")
    return
  }
  if (!write) {
    console.log(`Would write ${CHANGESET_FILE} (run with --write):\n\n${text}`)
    return
  }
  writeFileSync(CHANGESET_FILE, text)
  console.log(`Wrote ${CHANGESET_FILE}: commit it in a pull request before merging the Version Packages one.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
