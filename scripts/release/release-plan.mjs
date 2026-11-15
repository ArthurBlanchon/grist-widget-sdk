#!/usr/bin/env node
// What a push to main asks of the release workflow (.github/workflows/release.yml):
//
// - `version-pr`: changesets are pending, so the Version Packages pull
//   request is opened or brought up to date. No environment, no approval.
// - `publish`: a published package's version in its package.json is not on
//   npm yet, which happens when the Version Packages pull request has just
//   merged. Only then does the `npm` environment (and its approval) come in.
//
// Neither: nothing to do. Most pushes to main are like this, and they no
// longer leave a run waiting for an approval that publishes nothing (plan to
// 0.8.0, M1).
//
// Usage: node scripts/release/release-plan.mjs   (writes to $GITHUB_OUTPUT when set)

import { execFileSync } from "node:child_process"
import { appendFileSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

/** The packages the release publishes. */
export const PUBLISHED = ["packages/core", "packages/create-grist-widget"]

/** The pending changesets: every `.changeset/*.md` but its README. */
export function pendingChangesets(files) {
  return files.filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
}

/**
 * `{ versionPr, publish, unpublished }` from the pending changesets and, for
 * each published package, whether its version is on npm.
 */
export function releasePlan({ changesets, packages }) {
  const unpublished = packages.filter((p) => !p.onNpm).map((p) => `${p.name}@${p.version}`)
  return { versionPr: changesets.length > 0, publish: unpublished.length > 0, unpublished }
}

/** Whether `name@version` is on the npm registry. */
function onNpm(name, version) {
  try {
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return out.trim().length > 0
  } catch (err) {
    // E404: the package or the version doesn't exist. Anything else (the
    // registry down) must not look like "unpublished" and start a publish.
    if (/E404|404 Not Found/.test(String(err.stderr ?? err.message))) return false
    throw err
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  const changesets = pendingChangesets(readdirSync(path.join(root, ".changeset")))
  const packages = PUBLISHED.map((dir) => {
    const { name, version } = JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8"))
    return { name, version, onNpm: onNpm(name, version) }
  })
  const plan = releasePlan({ changesets, packages })
  console.log(`changesets pending: ${changesets.length}`)
  console.log(plan.publish ? `not on npm yet: ${plan.unpublished.join(", ")}` : "every published version is on npm")
  console.log(`version-pr=${plan.versionPr} publish=${plan.publish}`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version_pr=${plan.versionPr}\npublish=${plan.publish}\n`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
