#!/usr/bin/env node
// What a push to main asks of the release workflow (.github/workflows/release.yml):
//
// - `version-pr`: changesets are pending, so the Version Packages pull
//   request is opened or brought up to date. No environment, no approval.
// - `publish`: a published package's version in its package.json is not on
//   npm yet, and no changeset is pending: the Version Packages pull request
//   has just merged. Only then does the `npm` environment (and its approval)
//   come in. With changesets pending, changesets/action would version instead
//   of publishing, so a version left unpublished behind a newer changeset is
//   only reported: re-run the failed `publish` job of the Version Packages
//   merge commit's run, whose checkout has no changeset
//   (docs/operations/releasing.md).
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
  const unpublished = packages.filter((p) => !p.private && !p.onNpm).map((p) => `${p.name}@${p.version}`)
  return { versionPr: changesets.length > 0, publish: unpublished.length > 0 && changesets.length === 0, unpublished }
}

/** Whether a failed `npm view` means "not on npm" (a 404); anything else is an error. */
export function isNotFound(stderr) {
  return /\bE404\b|404 Not Found/.test(String(stderr))
}

/** Whether `name@version` is on the npm registry. */
function onNpm(name, version) {
  try {
    const out = execFileSync("npm", ["view", `${name}@${version}`, "version", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    return out.trim().length > 0
  } catch (err) {
    // E404: the package or the version doesn't exist. Anything else (the
    // registry down) must not look like "unpublished" and start a publish.
    if (isNotFound(err.stderr ?? err.message)) return false
    throw err
  }
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  const changesets = pendingChangesets(readdirSync(path.join(root, ".changeset")))
  const packages = PUBLISHED.map((dir) => {
    const manifest = JSON.parse(readFileSync(path.join(root, dir, "package.json"), "utf8"))
    const { name, version } = manifest
    // A package made private is never on npm: it must not ask for a publish on every push.
    return manifest.private ? { name, version, private: true, onNpm: false } : { name, version, onNpm: onNpm(name, version) }
  })
  const plan = releasePlan({ changesets, packages })
  console.log(`changesets pending: ${changesets.length}`)
  console.log(plan.unpublished.length ? `not on npm yet: ${plan.unpublished.join(", ")}` : "every published version is on npm")
  if (plan.unpublished.length && !plan.publish) {
    console.log(
      `::warning::${plan.unpublished.join(", ")} not on npm, but changesets are pending: not publishing from this push. Re-run the failed publish job of the Version Packages merge commit's run (docs/operations/releasing.md).`,
    )
  }
  console.log(`version-pr=${plan.versionPr} publish=${plan.publish}`)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `version_pr=${plan.versionPr}\npublish=${plan.publish}\n`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
