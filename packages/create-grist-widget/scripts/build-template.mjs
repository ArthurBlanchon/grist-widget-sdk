import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { ensureWidgetsManifest } from "../../../scripts/build-widgets-manifest.mjs"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const REPO_ROOT = path.join(PKG_ROOT, "..", "..")
const SOURCE = path.join(REPO_ROOT, "templates", "grist-widget-template-vite")
const DEST = path.join(PKG_ROOT, "template")

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

// -----------------------------------------------------------------------
// Batch H: embed everything `list`/`use`/`create --example` need to run
// fully offline from the published tarball — packages/create-grist-widget's
// own "files" only ships bin/template/LICENSE otherwise (see package.json).
// -----------------------------------------------------------------------

// scripts/compose-example.mjs's compose/overlay logic, copied verbatim.
// Safe because it's parameterized (createComposer({ templateDir, examplesDir,
// uiDir, manifestPath })) rather than hardcoding this monorepo's own
// layout — a byte-for-byte copy can never diverge in behavior from the
// monorepo original, only in which directories it's bound to. See that
// file's own header comment for the two-binding design.
const VENDOR_DEST = path.join(PKG_ROOT, "vendor")
rmSync(VENDOR_DEST, { recursive: true, force: true })
mkdirSync(VENDOR_DEST, { recursive: true })
cpSync(
  path.join(REPO_ROOT, "scripts", "compose-example.mjs"),
  path.join(VENDOR_DEST, "compose-example.mjs")
)

// Every example, verbatim: each examples/<id>/ with a WidgetApp.tsx. The
// rest of examples/ (its package.json, node_modules, _ui/, _demos/) is the
// monorepo's host for them, not content.
const EXAMPLES_DEST = path.join(PKG_ROOT, "examples")
rmSync(EXAMPLES_DEST, { recursive: true, force: true })
for (const id of readdirSync(path.join(REPO_ROOT, "examples"))) {
  if (!existsSync(path.join(REPO_ROOT, "examples", id, "WidgetApp.tsx"))) continue
  cpSync(path.join(REPO_ROOT, "examples", id), path.join(EXAMPLES_DEST, id), { recursive: true })
}

// widgets.json becomes this package's manifest.json: the offline catalog
// `list` reads and `create`'s interactive example-picker prompts from.
// Generated on demand if a caller didn't already build it (found live,
// repeatedly, before this existed: batch H's own smoke test, then the real
// npm release pipeline, both failing on a missing widgets.json this build
// script needs but never generated itself) — see ensureWidgetsManifest's
// own doc comment for the full story.
const rootManifestPath = path.join(REPO_ROOT, "widgets.json")
await ensureWidgetsManifest()
const manifest = JSON.parse(readFileSync(rootManifestPath, "utf8"))
writeFileSync(
  path.join(PKG_ROOT, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
)

// `@/components/ui/*` files examples need that the template doesn't already
// vendor — derived from the manifest's usesUi (never hardcoded, same "derive
// don't guess" spirit as build-widgets-manifest.mjs itself), so a future
// example needing a new primitive is picked up automatically on the next
// build rather than silently missing from a published CLI's compose step.
const exampleUiDir = path.join(REPO_ROOT, "examples", "_ui")
const templateUiNames = new Set(
  readdirSync(path.join(DEST, "src", "components", "ui"))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
)
const usedUiNames = new Set(manifest.flatMap((entry) => entry.usesUi ?? []))
const UI_SOURCE_DEST = path.join(PKG_ROOT, "ui-source")
rmSync(UI_SOURCE_DEST, { recursive: true, force: true })
mkdirSync(UI_SOURCE_DEST, { recursive: true })
let uiFilesCopied = 0
for (const name of usedUiNames) {
  if (templateUiNames.has(name)) continue
  const tsxPath = path.join(exampleUiDir, `${name}.tsx`)
  if (!existsSync(tsxPath)) continue
  cpSync(tsxPath, path.join(UI_SOURCE_DEST, `${name}.tsx`))
  uiFilesCopied++
  const cssPath = path.join(exampleUiDir, `${name}.css`)
  if (existsSync(cssPath)) cpSync(cssPath, path.join(UI_SOURCE_DEST, `${name}.css`))
}

console.log(
  `Embedded template with grist-widget-sdk@^${coreVersion}, create-grist-widget@^${cliVersion}, packageManager ${rootPkg.packageManager}\n` +
    `Embedded ${manifest.length} examples, ${uiFilesCopied} extra ui component(s), and the compose engine for offline list/use/create --example.`
)
