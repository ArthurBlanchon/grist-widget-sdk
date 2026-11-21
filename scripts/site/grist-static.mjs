// grist-static, the version demo pages load (GRIST_STATIC_VERSION in
// packages/create-grist-widget/src/demo-page.mjs), copied into the site at
// /grist-static/<version>/. Fetched from the npm registry at build time and
// checked against its pinned integrity, not installed: the package is
// 188 MB, and only the site build needs it. Source maps and the test bundle
// are left out (about 90 MB of the 188).

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { GRIST_STATIC_VERSION } from "../../packages/create-grist-widget/src/demo-page.mjs"

/** npm's `dist.integrity` for each version the site may serve. A new version adds its line. */
export const GRIST_STATIC_INTEGRITY = {
  "0.1.6": "sha512-E8vOLX+eCcR39sloeabJFZe4JGVDvZKVzxyfeBnK/VILp5R25Bcml64iGsPccMnSglkTt1i8O7wjci1uPySb7g==",
}

export const keepGristStaticFile = (rel) => !rel.endsWith(".map") && !/(^|\/)test\.bundle\.js/.test(rel)

export function integrityOf(buffer) {
  return `sha512-${createHash("sha512").update(buffer).digest("base64")}`
}

/**
 * grist-static `version`'s unpacked package folder, fetched from the npm
 * registry and checked against its pinned integrity the first time, then
 * reused from `cacheDir`.
 */
export async function gristStaticPackage(version = GRIST_STATIC_VERSION, { cacheDir = join(tmpdir(), "grist-static-cache") } = {}) {
  const expected = GRIST_STATIC_INTEGRITY[version]
  if (!expected) throw new Error(`grist-static ${version}: no pinned integrity in scripts/site/grist-static.mjs`)
  const unpacked = join(cacheDir, version)
  // Unpacked into a folder of its own, then renamed into place: a folder at
  // `unpacked` is complete, whichever of several builds made it.
  if (!existsSync(join(unpacked, "package", "dist", "latest.js"))) {
    const url = `https://registry.npmjs.org/grist-static/-/grist-static-${version}.tgz`
    console.log(`Fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`grist-static ${version}: ${url} answered ${res.status}`)
    const tarball = Buffer.from(await res.arrayBuffer())
    const actual = integrityOf(tarball)
    if (actual !== expected) throw new Error(`grist-static ${version}: integrity ${actual}, expected ${expected}. Refusing to publish it.`)
    mkdirSync(cacheDir, { recursive: true })
    const scratch = mkdtempSync(join(cacheDir, `.${version}-`))
    try {
      writeFileSync(join(scratch, "pkg.tgz"), tarball)
      execFileSync("tar", ["-xzf", join(scratch, "pkg.tgz"), "-C", scratch])
      rmSync(join(scratch, "pkg.tgz"))
      if (!existsSync(join(unpacked, "package", "dist", "latest.js"))) {
        rmSync(unpacked, { recursive: true, force: true })
        try {
          renameSync(scratch, unpacked)
        } catch (error) {
          if (!existsSync(join(unpacked, "package", "dist", "latest.js"))) throw error
        }
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }
  return join(unpacked, "package")
}

/** Copies grist-static's dist/ into `destDir`, from a cache dir if a previous build fetched it. */
export async function copyGristStatic(destDir, { version = GRIST_STATIC_VERSION, cacheDir } = {}) {
  const dist = join(await gristStaticPackage(version, { cacheDir }), "dist")
  cpSync(dist, destDir, {
    recursive: true,
    filter: (src) => src === dist || keepGristStaticFile(src.slice(dist.length + 1)),
  })
}
