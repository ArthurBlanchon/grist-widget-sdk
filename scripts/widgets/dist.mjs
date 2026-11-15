// Released widget versions (widget factory plan §7.3, ADR 0009).
//
// A catalog widget is released by raising the `version` in its package.json.
// On the merge to main, the release job (deploy-apps.yml) builds each version
// that isn't released yet, once, into the `widgets-dist` branch:
//
//   widgets-dist/<slug>/<version>/   the build (relative URLs), the widget's
//                                    CHANGELOG.md, and release.json (slug,
//                                    version, commit, released, and this
//                                    version's changelog entry as `changes`)
//
// A released version is never rebuilt or replaced, so what a Grist document
// loads never changes under it. The site build (build-site.mjs) copies the
// branch to /widgets/<slug>/<version>/, and the newest version of each widget
// to /widgets/<slug>/latest/.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const RELEASE_BRANCH = "widgets-dist"
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** -1, 0 or 1, for two x.y.z versions. */
export function compareVersions(a, b) {
  const pa = SEMVER.exec(a)
  const pb = SEMVER.exec(b)
  if (!pa || !pb) throw new Error(`not an x.y.z version: ${pa ? b : a}`)
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i])
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

/** The highest of `versions`, or null. */
export const latestVersion = (versions) => [...versions].sort(compareVersions).at(-1) ?? null

/** `{ slug: [versions] }` released in a checkout of widgets-dist (or {} if none). */
export function releasedVersions(distDir) {
  if (!distDir || !existsSync(distDir)) return {}
  const out = {}
  for (const slug of readdirSync(distDir, { withFileTypes: true })) {
    if (!slug.isDirectory() || slug.name.startsWith(".")) continue
    const versions = readdirSync(join(distDir, slug.name), { withFileTypes: true })
      .filter((v) => v.isDirectory() && SEMVER.test(v.name) && existsSync(join(distDir, slug.name, v.name, "index.html")))
      .map((v) => v.name)
    if (versions.length) out[slug.name] = versions.sort(compareVersions)
  }
  return out
}

/** `{ slug: version }` the widgets in `widgetsDir` declare in their package.json. */
export function declaredVersions(widgetsDir) {
  const out = {}
  for (const e of readdirSync(widgetsDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith(".")) continue
    const pkgPath = join(widgetsDir, e.name, "package.json")
    if (!existsSync(pkgPath)) continue
    const { version } = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (!SEMVER.test(version ?? "")) throw new Error(`widgets/${e.name}: version must be x.y.z, not ${version}`)
    out[e.name] = version
  }
  return out
}

/** The declared versions not released yet: `[{ slug, version }]`. */
export function unreleased(declared, released) {
  return Object.entries(declared)
    .filter(([slug, version]) => !(released[slug] ?? []).includes(version))
    .map(([slug, version]) => ({ slug, version }))
}
