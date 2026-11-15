#!/usr/bin/env node
// node scripts/widgets/release.mjs <widgets-dist checkout>
//
// Builds every catalog widget version that isn't in the checkout yet into
// <checkout>/<slug>/<version>/, with a release.json, and prints what it added
// (one `<slug>@<version>` per line, nothing when all is released). Never
// touches a version already there. The SDK must be built first.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

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
  const out = join(distDir, slug, version)
  console.error(`Building ${slug}@${version}`)
  execFileSync("pnpm", ["--filter", `@grist-widgets/${slug}`, "exec", "vite", "build", "--outDir", out, "--emptyOutDir"], {
    cwd: repoRoot,
    stdio: ["ignore", "inherit", "inherit"],
  })
  writeFileSync(
    join(out, "release.json"),
    `${JSON.stringify({ slug, version, commit, released: new Date().toISOString() }, null, 2)}\n`,
  )
  console.log(`${slug}@${version}`)
}
