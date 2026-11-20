import {
  cpSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPO_ROOT = path.join(PKG_ROOT, "..", "..")
const SOURCE = path.join(REPO_ROOT, "templates", "grist-widget-template-vite")
const DEST = path.join(PKG_ROOT, "template")

// The README's template-only blocks (src/template-only.mjs) must be whole:
// an unbalanced marker would ship the template's maintainer notes silently.
{
  const readme = readFileSync(path.join(SOURCE, "README.md"), "utf8")
  const starts = readme.match(/<!-- template-only:start[^>]*-->/g)?.length ?? 0
  const ends = readme.match(/<!-- template-only:end -->/g)?.length ?? 0
  if (starts !== ends || /<!-- template-only:start[^\n]*>[^\n]*-->/.test(readme.replace(/<!-- template-only:start[^>]*-->/g, ""))) {
    throw new Error(`build-template: the template README's template-only markers are unbalanced (${starts} start, ${ends} end)`)
  }
}

rmSync(DEST, { recursive: true, force: true })
const SKIP = new Set(["node_modules", "dist", ".turbo"])
cpSync(SOURCE, DEST, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) })

// npm always strips a literal `.gitignore` from published packages (same
// list as `.git`/`.npmignore`), no matter what `files` says — rename it so
// it survives the tarball, then the CLI renames it back at scaffold time.
const gitignorePath = path.join(DEST, ".gitignore")
if (existsSync(gitignorePath)) renameSync(gitignorePath, path.join(DEST, "_gitignore"))

const rootPkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"))
const coreVersion = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "packages", "core", "package.json"), "utf8"),
).version
const cliVersion = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "packages", "create-grist-widget", "package.json"), "utf8"),
).version

const pkgPath = path.join(DEST, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
pkg.dependencies["grist-widget-sdk"] = `^${coreVersion}`
// The deploy workflow runs this CLI's `grist-widget-deploy` bin, so a
// scaffold depends on the version that made it: deploy.yml and the commands
// it calls always match, and later fixes arrive as dependency updates.
pkg.devDependencies["create-grist-widget"] = `^${cliVersion}`
// Without this, the bundled deploy workflow's pnpm/action-setup step fails
// on a freshly scaffolded repo's very first CI run ("No pnpm version is
// specified") — read live off the monorepo's own pin, never hardcoded.
pkg.packageManager = rootPkg.packageManager
// prebuild builds the SDK via the workspace filter — meaningless outside the monorepo.
delete pkg.scripts.prebuild
// A fresh scaffold's own version must always start at 0.0.1 (checked by
// scripts/smoke/create-widget.sh) — it's the widget author's version to
// own from that point on, unrelated to this monorepo's release cadence.
// Force it here rather than trusting the source repo's own package.json to
// hold still: it drifted to 0.0.2 once already, bumped as a side effect of
// Changesets' `updateInternalDependencies` sweeping every workspace
// package that depends on grist-widget-sdk (see .changeset/config.json
// `ignore` for the actual fix — this is the belt-and-suspenders backstop
// at the one choke point that actually matters).
pkg.version = "0.0.1"
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

// What earlier versions also embedded for `list`, `use` and
// `create --example` (examples, their ui components, the compose engine)
// was retired with examples/ (ADR 0023): remove what an older build left.
for (const stale of ["vendor", "examples", "ui-source", "manifest.json"]) {
  rmSync(path.join(PKG_ROOT, stale), { recursive: true, force: true })
}

console.log(
  `Embedded template with grist-widget-sdk@^${coreVersion}, create-grist-widget@^${cliVersion}, packageManager ${rootPkg.packageManager}`
)
