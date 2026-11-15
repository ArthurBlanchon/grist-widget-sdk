#!/usr/bin/env node
// node scripts/widgets/release.mjs <widgets-dist checkout>
//
// Builds every catalog widget version that isn't in the checkout yet into
// <checkout>/<slug>/<version>/, with a release.json, and prints what it added
// (one `<slug>@<version>` per line, nothing when all is released). Never
// touches a version already there. The SDK must be built first.

import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { changelogEntries, checkChangelog } from "./check-widgets.mjs"
import { declaredVersions, releasedVersions, unreleased } from "./dist.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const distDir = process.argv[2] && resolve(process.argv[2])
if (!distDir) {
  console.error("Usage: node scripts/widgets/release.mjs <widgets-dist checkout>")
  process.exit(2)
}
mkdirSync(distDir, { recursive: true })

const todo = unreleased(declaredVersions(join(repoRoot, "widgets")), releasedVersions(distDir))
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim()
for (const { slug, version } of todo) {
  // A release is never rebuilt, so one without its changelog entry would stay
  // without it for good: refuse it here too, not only in the pull request's CI.
  const changelog = join(repoRoot, "widgets", slug, "CHANGELOG.md")
  const problems = checkChangelog(join(repoRoot, "widgets", slug), version)
  if (problems.length) {
    console.error(`${slug}@${version}: ${problems.join("; ")}`)
    process.exit(1)
  }
  const out = join(distDir, slug, version)
  console.error(`Building ${slug}@${version}`)
  execFileSync("pnpm", ["--filter", `@grist-widgets/${slug}`, "exec", "vite", "build", "--outDir", out, "--emptyOutDir"], {
    cwd: repoRoot,
    stdio: ["ignore", "inherit", "inherit"],
  })
  // The widget's changelog travels with each version: /widgets/<slug>/<version>/CHANGELOG.md,
  // and this version's entry in release.json.
  const changes = changelogEntries(readFileSync(changelog, "utf8")).find(([v]) => v === version)[1]
  copyFileSync(changelog, join(out, "CHANGELOG.md"))
  writeFileSync(
    join(out, "release.json"),
    `${JSON.stringify({ slug, version, commit, released: new Date().toISOString(), changes, changelog: "CHANGELOG.md" }, null, 2)}\n`,
  )
  console.log(`${slug}@${version}`)
}
