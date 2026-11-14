// `create-grist-widget upgrade`: bring a scaffolded widget's template files
// up to this CLI's template (plan T2, docs/history/2026-11-01-widget-lifecycle-plan.md).
//
// The template's files are an explicit list, TEMPLATE_FILES. upgrade
// overwrites those, deletes the files earlier templates wrote that are gone
// now (RETIRED_FILES), switches a tsconfig.app.json / tsconfig.node.json that
// predates the SDK's base once (SDK_TSCONFIGS), merges package.json's
// template-set scripts and dependency versions, and prunes pnpm age
// exceptions that no longer matter. The widget's own files (src/app/, smoke
// test included, src/components/ui/, src/index.css, components.json, README.md
// and every file the widget added) it only touches through the codemods
// (codemods.mjs): the grist-widget-sdk names a release deprecated, rewritten
// where the meaning is the same, listed by file and line where it isn't. It
// runs on a clean `dev`, so what it changed is one `git diff` to review.

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import { runCodemods } from "./codemods.mjs"

/**
 * The files the template writes and keeps identical in every widget. Listed
 * in the template's AGENTS.md and on the Upgrading a widget page too
 * (tests/upgrade.test.mjs checks all three agree with the template itself).
 *
 * components.json isn't one: it is shadcn's configuration, and a widget adds
 * the registries `shadcn add` installs from to it.
 */
export const TEMPLATE_FILES = [
  ".github/dependabot.yml",
  ".github/rulesets/dev.json",
  ".github/rulesets/main.json",
  ".github/rulesets/tags.json",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy.yml",
  ".prettierignore",
  ".prettierrc",
  "AGENTS.md",
  "CLAUDE.md",
  "eslint.config.js",
  "src/components/theme-provider.tsx",
  "src/lib/utils.ts",
  "src/main.tsx",
  "src/vite-env.d.ts",
  "tsconfig.json",
  "vite.config.ts",
]

/**
 * Files earlier templates wrote that the current one doesn't: upgrade
 * deletes each one still there, unless a file the widget keeps still refers
 * to it (then it says which, and leaves both alone).
 */
export const RETIRED_FILES = [
  "public/vite.svg",
  "scripts/deploy.mjs",
  "src/assets/react.svg",
  "src/components/channel-notice.tsx",
  "src/components/grist-sdk-alerts.tsx",
  "src/components/grist-status-chip.tsx",
  "src/components/local-dev-notice.tsx",
  "src/components/release-info.tsx",
  "src/components/scaffold-footer.tsx",
  "src/components/template-landing.tsx",
  "src/lib/grist-handshake-status.ts",
  "src/lib/showcase-routing.ts",
  "src/lib/showcase-versions.ts",
  "vite-widget-meta.ts",
]

/**
 * Fingerprints of every `src/main.tsx` the template has shipped
 * ({@link mainFingerprint}). `upgrade` rewrites `src/main.tsx` only when the
 * widget's is one of them: anything else holds something of the widget's own,
 * which belongs in `src/app/App.tsx` (an `Alerts`, `LocalDevPage` or
 * `ReleasePage` export, a provider inside `App`, a `lazy()` App), where no
 * upgrade overwrites it. A template that changes `src/main.tsx` adds its
 * fingerprint here (tests/upgrade.test.mjs checks the current one is listed).
 */
export const SHIPPED_MAIN_TSX = new Set([
  "76d7e48498cc7396", // 0.5.0: mountGristWidget(entry), the entry module's exports
  "6b36706bf47890dc", // 0.3.26 to 0.4.x: mountGristWidget({ App, options: GRIST_OPTIONS, dev })
  "9fa36b761f15f075",
  "2c1a90ee3af3a192",
  "ddfbf54e22cb7666",
  "f79ba0cdd7815824",
  "e2b51406a05d2b99",
  "3f4a84ba97c17bb4",
  "fff6cfaa68dd4983",
  "582d4c6545b26c0c",
  "56df73466511be3b",
  "0e81ebbfef98d34c",
  "ca73d20c1e640418",
  "8191ebe19835393e",
  "fd649927d4b6d91b",
  "144dd391a0c26a5a",
])

/**
 * A `src/main.tsx`'s fingerprint, blind to formatting: whitespace,
 * semicolons and the quote style don't count, so `pnpm format` changes
 * nothing.
 */
export function mainFingerprint(text) {
  const normalized = text.replace(/\r/g, "").replace(/'/g, '"').replace(/;/g, "").replace(/\s+/g, "")
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16)
}

/**
 * The CLI version that added each template file. A file the widget already
 * has at that path, made with an older template, is the widget's own: upgrade
 * refuses to write over it. Every TEMPLATE_FILES entry has one
 * (tests/upgrade.test.mjs).
 */
export const TEMPLATE_FILE_SINCE = Object.fromEntries(TEMPLATE_FILES.map((file) => [file, "0.0.0"]))

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** `[major, minor, patch]` of a plain version, or null. */
export function parseVersion(version) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(version ?? "").trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** Lowest version a `^x.y.z`, `~x.y.z` or `x.y.z` range allows, or null for any other range. */
export function rangeFloor(range) {
  const m = /^[\^~]?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)$/.exec(String(range ?? "").trim())
  return m ? parseVersion(m[1]) : null
}

export function compareVersions(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  return 0
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"))
  } catch {
    return null
  }
}

const UPGRADING_URL = "https://gristwidgets.com/docs/cli/upgrading"

/**
 * Why `upgrade` must not run in `cwd`, or null when it may.
 *
 * @param {string} cwd
 * @param {{ cliVersion: string, templateDir?: string, force?: boolean, since?: Record<string, string> }} options
 *   `templateDir` enables the checks on the widget's own files (a changed
 *   `src/main.tsx`, a file at a path a newer template starts using), which
 *   `force` skips.
 * @returns {null | { reason: string, message: string }}
 */
export function upgradeRefusal(cwd, { cliVersion, templateDir, force = false, since = TEMPLATE_FILE_SINCE }) {
  const refuse = (reason, message) => ({ reason, message: `upgrade: ${message}` })

  try {
    git(cwd, ["rev-parse", "--is-inside-work-tree"])
  } catch {
    return refuse(
      "no-repo",
      'this command rewrites the template\'s files and must run inside a git repository, so the change is easy to review and undo. Run "git init" first.'
    )
  }

  const pkg = readJson(path.join(cwd, "package.json"))
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
  if (!pkg || !("grist-widget-sdk" in deps)) {
    return refuse("not-a-widget", "run it at the root of a widget made with create-grist-widget (no package.json depending on grist-widget-sdk here).")
  }

  let branch = ""
  try {
    branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
  } catch {
    // No commit yet: not on main either.
  }
  if (branch === "main") {
    return refuse("on-main", 'run it on "dev" (git switch dev): main only changes by merging dev into it, after the deploy preview there has been checked.')
  }

  if (git(cwd, ["status", "--porcelain"])) {
    return refuse("dirty", "the working tree has uncommitted changes. Commit or stash them first, so what upgrade changes is one diff to review and undo.")
  }

  if (existsSync(path.join(cwd, "src", "App.tsx"))) {
    return refuse(
      "old-layout",
      `this widget is still in src/App.tsx. Widgets now live in src/app/, which the template's src/main.tsx imports: move it there first (${UPGRADING_URL}#widgets-scaffolded-before-srcapp), then run upgrade again.`
    )
  }
  if (!existsSync(path.join(cwd, "src", "app", "App.tsx"))) {
    return refuse("no-entry", "src/app/App.tsx is missing. The template's src/main.tsx and smoke test import the widget from there.")
  }

  const madeWith = parseVersion(pkg.createGristWidgetVersion)
  const running = parseVersion(cliVersion)
  if (madeWith && running && compareVersions(madeWith, running) > 0) {
    return refuse(
      "newer-widget",
      `this widget is already on create-grist-widget ${pkg.createGristWidgetVersion}'s template, newer than this CLI (${cliVersion}). Run the version it depends on: pnpm exec create-grist-widget upgrade.`
    )
  }

  if (templateDir && !force) {
    const main = path.join(cwd, "src", "main.tsx")
    const template = readFileSync(path.join(templateDir, "src", "main.tsx"), "utf8")
    if (existsSync(main)) {
      const fingerprint = mainFingerprint(readFileSync(main, "utf8"))
      if (fingerprint !== mainFingerprint(template) && !SHIPPED_MAIN_TSX.has(fingerprint)) {
        return refuse(
          "custom-main",
          `src/main.tsx holds changes of the widget's own, and upgrade would overwrite them. Move them into src/app/App.tsx, where no upgrade writes: export Alerts, LocalDevPage or ReleasePage, put a provider inside App, or export a lazy() App (https://gristwidgets.com/docs/sdk/api/app#the-entry-module). Then restore the template's src/main.tsx ("git log -p src/main.tsx" shows what changed) and run upgrade again, or run "upgrade --force" to overwrite it.`
        )
      }
    }
    const collisions = TEMPLATE_FILES.filter((file) => {
      const added = parseVersion(since[file] ?? "0.0.0")
      if (!madeWith || !added || compareVersions(madeWith, added) >= 0) return false
      const own = path.join(cwd, file)
      return existsSync(own) && !readFileSync(own).equals(readFileSync(path.join(templateDir, file)))
    })
    if (collisions.length) {
      return refuse(
        "collision",
        `this template adds ${collisions.join(", ")}, and the widget already has a file of its own there. Move it into src/app/, the widget's folder no template writes to, then run upgrade again, or run "upgrade --force" to overwrite it.`
      )
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

/**
 * The widget's package.json with the template's scripts and dependency
 * versions applied: each template script replaces the widget's of the same
 * name; each template dependency is added if missing and raised to the
 * template's range if the widget's allows older versions. A range that isn't
 * plain semver on either side (workspace:, file:, a tag...) and everything
 * else the widget has are kept.
 *
 * @returns {{ pkg: object, changes: string[] }}
 */
export function mergePackageJson(widgetPkg, templatePkg, cliVersion) {
  const pkg = structuredClone(widgetPkg)
  const changes = []

  for (const [name, command] of Object.entries(templatePkg.scripts ?? {})) {
    pkg.scripts ??= {}
    if (pkg.scripts[name] === command) continue
    changes.push(
      name in pkg.scripts
        ? `scripts.${name}: "${pkg.scripts[name]}" -> "${command}"`
        : `scripts.${name}: added "${command}"`
    )
    pkg.scripts[name] = command
  }

  for (const section of ["dependencies", "devDependencies"]) {
    for (const [name, range] of Object.entries(templatePkg[section] ?? {})) {
      const owner = ["dependencies", "devDependencies"].find((s) => pkg[s] && name in pkg[s])
      if (!owner) {
        pkg[section] ??= {}
        pkg[section][name] = range
        changes.push(`${section}.${name}: added ${range}`)
        continue
      }
      const current = pkg[owner][name]
      const theirs = rangeFloor(current)
      const ours = rangeFloor(range)
      if (!theirs || !ours || compareVersions(ours, theirs) <= 0) continue
      pkg[owner][name] = range
      changes.push(`${owner}.${name}: ${current} -> ${range}`)
    }
  }

  const manager = /^([^@]+)@(.+)$/.exec(templatePkg.packageManager ?? "")
  const theirManager = /^([^@]+)@(.+)$/.exec(pkg.packageManager ?? "")
  if (manager && !theirManager) {
    pkg.packageManager = templatePkg.packageManager
    changes.push(`packageManager: added ${templatePkg.packageManager}`)
  } else if (manager && theirManager && manager[1] === theirManager[1]) {
    const ours = parseVersion(manager[2].split("+")[0])
    const theirs = parseVersion(theirManager[2].split("+")[0])
    if (ours && theirs && compareVersions(ours, theirs) > 0) {
      changes.push(`packageManager: ${pkg.packageManager} -> ${templatePkg.packageManager}`)
      pkg.packageManager = templatePkg.packageManager
    }
  }

  if (pkg.createGristWidgetVersion !== cliVersion) {
    changes.push(`createGristWidgetVersion: ${pkg.createGristWidgetVersion ?? "(none)"} -> ${cliVersion}`)
    pkg.createGristWidgetVersion = cliVersion
  }
  return { pkg, changes }
}

// ---------------------------------------------------------------------------
// pnpm age exceptions
// ---------------------------------------------------------------------------

// pnpm 11's default minimumReleaseAge, in minutes.
const DEFAULT_MIN_AGE_MINUTES = 24 * 60

/** The `minimumReleaseAge` a pnpm-workspace.yaml sets, in minutes, or pnpm's default. */
export function minimumReleaseAge(workspaceYaml) {
  const m = /^minimumReleaseAge:\s*(\d+)\s*(#.*)?$/m.exec(workspaceYaml)
  return m ? Number(m[1]) : DEFAULT_MIN_AGE_MINUTES
}

/** `{ name, versions }` for a `name@1.2.3` (or `name@1.2.3 || 1.2.4`) entry, or null for any other. */
/** An npm package name (scoped or not), as npm itself accepts it for a new package. */
export const NPM_PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

export function parseExactEntry(entry) {
  const m = /^(@?[^@\s]+)@(.+)$/.exec(entry)
  // The name is later passed to `npm view`: anything but a package name is not an entry.
  if (!m || !NPM_PACKAGE_NAME.test(m[1])) return null
  const versions = m[2].split("||").map((v) => v.trim())
  return versions.every((v) => parseVersion(v)) ? { name: m[1], versions } : null
}

const KEY = "minimumReleaseAgeExclude"

/**
 * Walk the `minimumReleaseAgeExclude` list (block or flow style), passing
 * each entry to `decide`, which returns it unchanged, a replacement, or null
 * to drop it. The key goes too once no entry is left. Its own parser rather
 * than age-exceptions.mjs's: pnpm writes several versions of a package as
 * one `name@1.2.3 || 1.2.4` entry, with spaces in it.
 */
function rewriteAgeExceptions(workspaceYaml, decide) {
  const flowRe = new RegExp(`^${KEY}:\\s*\\[(.*)\\]\\s*(#.*)?$`)
  const blockRe = new RegExp(`^${KEY}:\\s*(#.*)?$`)
  const out = []
  let keyIndex = -1 // index in `out` of the block's key line, while in the block
  let kept = 0
  const closeBlock = () => {
    if (keyIndex >= 0 && kept === 0) out.splice(keyIndex, 1)
    keyIndex = -1
  }
  for (const line of workspaceYaml.split("\n")) {
    const bare = line.replace(/\r$/, "")
    const flow = flowRe.exec(bare)
    if (flow) {
      closeBlock()
      const items = flow[1]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .flatMap((item) => {
          const quote = /^["']/.exec(item)?.[0] ?? ""
          const next = decide(item.replace(/^["']|["']$/g, ""))
          return next === null ? [] : [`${quote}${next}${quote}`]
        })
      if (items.length) out.push(`${KEY}: [${items.join(", ")}]${flow[2] ? ` ${flow[2]}` : ""}`)
      continue
    }
    if (blockRe.test(bare)) {
      closeBlock()
      keyIndex = out.length
      kept = 0
      out.push(line)
      continue
    }
    if (keyIndex >= 0) {
      const item = /^(\s+-\s+)(["']?)(.+?)\2(\s+#.*)?\s*$/.exec(bare)
      if (item) {
        const next = decide(item[3])
        if (next !== null) {
          out.push(next === item[3] ? line : `${item[1]}${item[2]}${next}${item[2]}${item[4] ?? ""}`)
          kept++
        }
        continue
      }
      if (!/^\s*(#.*)?$/.test(bare)) closeBlock() // the next key: the list is over
    }
    out.push(line)
  }
  closeBlock()
  return out.join("\n")
}

/**
 * pnpm-workspace.yaml without the `minimumReleaseAgeExclude` versions that
 * are now older than its `minimumReleaseAge`: those exceptions no longer
 * change what pnpm installs. Entries naming no exact version, and versions
 * whose publish time can't be looked up, are kept.
 *
 * @param {string} workspaceYaml
 * @param {{ publishedAt: (name: string, version: string) => Date | null, now: Date }} options
 * @returns {{ yaml: string, removed: string[], unknown: string[] }}
 */
export function pruneAgeExceptions(workspaceYaml, { publishedAt, now }) {
  const minAgeMs = minimumReleaseAge(workspaceYaml) * 60 * 1000
  const removed = []
  const unknown = []
  const yaml = rewriteAgeExceptions(workspaceYaml, (entry) => {
    const parsed = parseExactEntry(entry)
    if (!parsed) return entry
    const keep = parsed.versions.filter((version) => {
      const at = publishedAt(parsed.name, version)
      if (!at) {
        unknown.push(`${parsed.name}@${version}`)
        return true
      }
      if (now.getTime() - at.getTime() < minAgeMs) return true
      removed.push(`${parsed.name}@${version}`)
      return false
    })
    if (keep.length === parsed.versions.length) return entry
    return keep.length ? `${parsed.name}@${keep.join(" || ")}` : null
  })
  return { yaml: removed.length ? yaml : workspaceYaml, removed, unknown }
}

// ---------------------------------------------------------------------------
// Retired files
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage"])
const SCANNED = /\.(tsx?|jsx?|mjs|cjs|css|html|json|ya?ml)$/

function listFiles(root, dir = root) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(root, full))
    else out.push(path.relative(root, full).split(path.sep).join("/"))
  }
  return out
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * How another file would refer to `file`: a TypeScript module by an import
 * path ending in its name, with or without the extension (`@/lib/x`,
 * `./x.tsx`); anything else (a script, an asset) by its full file name.
 */
function referencePattern(file) {
  const base = path.posix.basename(file)
  if (/\.tsx?$/.test(base)) {
    const stem = base.replace(/\.tsx?$/, "")
    return new RegExp(`/${escapeRegExp(stem)}(\\.(tsx?|jsx?))?["'\`]`)
  }
  return new RegExp(`(^|[/"'\`\\s(])${escapeRegExp(base)}`, "m")
}

/**
 * Which retired files in `cwd` nothing refers to any more (`remove`), and
 * which are still referred to, by what (`keep`). Run after the template's
 * files are written, so their new content is what counts.
 */
export function retiredFilesPlan(cwd) {
  const present = RETIRED_FILES.filter((file) => existsSync(path.join(cwd, file)))
  const scanned = listFiles(cwd).filter(
    (file) => SCANNED.test(file) && !present.includes(file) && file !== "pnpm-lock.yaml" && file !== "package-lock.json"
  )
  const contents = new Map(scanned.map((file) => [file, readFileSync(path.join(cwd, file), "utf8")]))
  const remove = []
  const keep = []
  for (const file of present) {
    const pattern = referencePattern(file)
    const by = scanned.filter((other) => pattern.test(contents.get(other)))
    if (by.length) keep.push({ file, by })
    else remove.push(file)
  }
  return { remove, keep }
}

function removeEmptyParents(cwd, file) {
  let dir = path.dirname(path.join(cwd, file))
  while (dir.startsWith(cwd + path.sep) && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true })
    dir = path.dirname(dir)
  }
}

// ---------------------------------------------------------------------------
// tsconfig.app.json / tsconfig.node.json
// ---------------------------------------------------------------------------

/**
 * The widget's TypeScript configs. They are the widget's (its paths and
 * types): their compiler settings come from the grist-widget-sdk base they
 * extend. One written before that base existed extends nothing and carries
 * those settings itself, so upgrade switches it to the template's once.
 */
export const SDK_TSCONFIGS = ["tsconfig.app.json", "tsconfig.node.json"]

/** JSON with comments and trailing commas, as tsconfig files allow. */
export function parseJsonc(text) {
  let out = ""
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === "\\") out += text[++i] ?? ""
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      out += c
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++
      out += "\n"
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2)
      if (end < 0) break
      i = end + 1
    } else {
      out += c
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"))
}

/**
 * The template's version of a widget tsconfig that extends nothing yet, with
 * the widget's `compilerOptions.types` added to the template's. Null for one
 * that extends a base already (the SDK's, or one the widget chose).
 *
 * @returns {null | { content: string, types: string[] } | { unreadable: true }}
 */
export function migratedTsconfig(widgetText, templateText) {
  let widget
  try {
    widget = parseJsonc(widgetText)
  } catch {
    return { unreadable: true }
  }
  if (widget?.extends !== undefined) return null
  const types = widget?.compilerOptions?.types ?? []
  const templateTypes = parseJsonc(templateText)?.compilerOptions?.types ?? []
  const merged = [...templateTypes, ...types.filter((t) => !templateTypes.includes(t))]
  const content = templateText.replace(/"types":\s*\[[^\]]*\]/, `"types": ${JSON.stringify(merged).replace(/","/g, '", "')}`)
  return { content, types: merged }
}

// ---------------------------------------------------------------------------
// The upgrade
// ---------------------------------------------------------------------------

/**
 * Apply `templateDir`'s template to the widget at `cwd`. Call
 * {@link upgradeRefusal} first.
 *
 * @param {{
 *   cwd: string,
 *   templateDir: string,
 *   cliVersion: string,
 *   publishedAt: (name: string, version: string) => Date | null,
 *   now?: Date,
 * }} options
 */
/** The grist-widget-sdk version whose names the codemods (codemods.mjs) rewrite to. */
export const CODEMODS_SINCE = [0, 6, 0]

export function runUpgrade({ cwd, templateDir, cliVersion, publishedAt, now = new Date() }) {
  const report = {
    fromVersion: readJson(path.join(cwd, "package.json"))?.createGristWidgetVersion ?? null,
    written: [],
    deleted: [],
    keptRetired: [],
    tsconfigs: [],
    tsconfigsUnreadable: [],
    packageChanges: [],
    ageRemoved: [],
    ageUnknown: [],
    codemods: [],
    deprecatedLeft: [],
  }

  for (const file of TEMPLATE_FILES) {
    const from = path.join(templateDir, file)
    const to = path.join(cwd, file)
    const next = readFileSync(from)
    if (existsSync(to) && readFileSync(to).equals(next)) continue
    mkdirSync(path.dirname(to), { recursive: true })
    cpSync(from, to)
    report.written.push(file)
  }

  for (const file of SDK_TSCONFIGS) {
    const to = path.join(cwd, file)
    const templateText = readFileSync(path.join(templateDir, file), "utf8")
    if (!existsSync(to)) {
      writeFileSync(to, templateText)
      report.tsconfigs.push({ file, types: parseJsonc(templateText)?.compilerOptions?.types ?? [] })
      continue
    }
    const migrated = migratedTsconfig(readFileSync(to, "utf8"), templateText)
    if (!migrated) continue
    if (migrated.unreadable) {
      report.tsconfigsUnreadable.push(file)
      continue
    }
    writeFileSync(to, migrated.content)
    report.tsconfigs.push({ file, types: migrated.types })
  }

  const { remove, keep } = retiredFilesPlan(cwd)
  for (const file of remove) {
    rmSync(path.join(cwd, file))
    removeEmptyParents(cwd, file)
    report.deleted.push(file)
  }
  report.keptRetired = keep

  const pkgPath = path.join(cwd, "package.json")
  const templatePkg = JSON.parse(readFileSync(path.join(templateDir, "package.json"), "utf8"))
  const { pkg, changes } = mergePackageJson(JSON.parse(readFileSync(pkgPath, "utf8")), templatePkg, cliVersion)
  if (changes.length) writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")
  report.packageChanges = changes

  const workspacePath = path.join(cwd, "pnpm-workspace.yaml")
  if (existsSync(workspacePath)) {
    const before = readFileSync(workspacePath, "utf8")
    const { yaml, removed, unknown } = pruneAgeExceptions(before, { publishedAt, now })
    if (yaml !== before) writeFileSync(workspacePath, yaml)
    report.ageRemoved = removed
    report.ageUnknown = unknown
  }

  // The codemods rewrite to names grist-widget-sdk 0.6 added: only once the template depends on it.
  const sdkFloor = rangeFloor(templatePkg.dependencies?.["grist-widget-sdk"])
  if (sdkFloor && compareVersions(sdkFloor, CODEMODS_SINCE) >= 0) {
    const { rewritten, manual } = runCodemods(cwd, { skip: TEMPLATE_FILES })
    report.codemods = rewritten
    report.deprecatedLeft = manual
  }
  return report
}
