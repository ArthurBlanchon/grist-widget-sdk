#!/usr/bin/env node
// What grist-widget-template needs on top of a fresh scaffold to be listed
// in awesome-grist-widgets, applied by template-canary.yml after each
// overlay (the canary replaces every tracked file with the scaffold, so
// edits made in that repo by hand wouldn't last):
// - LICENSE: this repo's MIT license, and "license": "MIT" in package.json.
//   The template itself ships no license: a widget's owner picks theirs.
// - README.md: its install URL, the /latest/ GitHub Pages URL, written the
//   way a widget's first release writes it (deploy.mjs). The template repo
//   released long ago, so that release never writes it again.
//
//   node scripts/template-repo-extras.mjs <repo dir> <owner/repo> <LICENSE file>

import { copyFileSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { latestPagesUrl, withInstallUrl } from "../packages/create-grist-widget/src/deploy.mjs"

export function applyExtras(repoDir, ownerRepo, licenseFile) {
  const url = latestPagesUrl(ownerRepo)
  if (!url) throw new Error(`expected owner/repo, got ${JSON.stringify(ownerRepo)}`)
  copyFileSync(licenseFile, path.join(repoDir, "LICENSE"))
  const pkgFile = path.join(repoDir, "package.json")
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"))
  writeFileSync(pkgFile, JSON.stringify({ ...pkg, license: "MIT" }, null, 2) + "\n")
  const readmeFile = path.join(repoDir, "README.md")
  const readme = readFileSync(readmeFile, "utf8")
  const next = withInstallUrl(readme, url)
  if (next === readme && !readme.includes(url)) throw new Error("README.md has no install-url block to write into")
  writeFileSync(readmeFile, next)
  return { url }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repoDir, ownerRepo, licenseFile] = process.argv.slice(2)
  if (!repoDir || !ownerRepo || !licenseFile) {
    console.error("Usage: template-repo-extras.mjs <repo dir> <owner/repo> <LICENSE file>")
    process.exit(2)
  }
  console.log(`template repo: MIT license, install URL ${applyExtras(repoDir, ownerRepo, licenseFile).url}`)
}
