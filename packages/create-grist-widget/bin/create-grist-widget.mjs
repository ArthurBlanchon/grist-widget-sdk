#!/usr/bin/env node
// create-grist-widget — scaffold a Grist custom widget, fully offline.
//
// Five verbs (batch H, docs/history/2026-08-08-execution-plan.md §98-105, and
// T2 of docs/history/2026-11-01-widget-lifecycle-plan.md):
//   create <name>                    scaffold a new widget into ./<name>
//   init                             scaffold into the current directory
//   upgrade                          bring the template's files up to this CLI's
//   demo [--save] [--port <n>]       the widget in a real Grist on this machine (Docker);
//                                    --save writes its static demo into public/demo/
//   release <patch|minor|major>      the release commit on dev (version, CHANGELOG.md)
//   protect [--dry-run]              the repository settings a template copy lacks (rulesets, ...), via gh
//   manifest --base <path>           write dist/grist-widget.json (the deploy workflow's build job)
//
// Every scaffold starts from the one template (ADR 0023): an agent or a
// person adapts it, reading the catalog's widgets (widgets/<slug>/: spec,
// code, tests) for patterns.

import { HELP } from "../src/help.mjs"
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync, execSync } from "node:child_process"
import * as clack from "@clack/prompts"

import { addedAgeExceptions } from "../src/age-exceptions.mjs"
import { installPlan } from "../src/package-manager.mjs"
import { RENAMED_NAMES_URL } from "../src/codemods.mjs"
import { runUpgrade, upgradeRefusal } from "../src/upgrade.mjs"
import { BUMPS, runRelease } from "../src/release.mjs"
import { runProtect } from "../src/protect.mjs"
import { DEMO_DIR, demoArgs, demoRefusal, runDemo, saveDemo } from "../src/demo.mjs"
import { MANIFEST_FILE, writeManifest } from "../src/manifest.mjs"
import { stripTemplateOnly } from "../src/template-only.mjs"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const TEMPLATE_DIR = path.join(PKG_ROOT, "template")

const cliPkg = JSON.parse(readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"))

/** Where `--example`, `list` and `use` (retired in 0.8, ADR 0023) now send people: the catalog. */
const CATALOG_NOTE =
  "create-grist-widget starts every widget from its template. For a starting point close to yours, read a catalog" +
  " widget's spec, code and tests: https://gristwidgets.com/widgets/ (sources: https://github.com/ArthurBlanchon/grist-widget-sdk/tree/main/widgets)."

function retired(what, hint = "") {
  console.error(`${what} was retired in create-grist-widget 0.8. ${CATALOG_NOTE}${hint}`)
  process.exit(1)
}

/** `--example` is retired; `--example blank`, which always meant the template, still does. */
function refuseExample(args) {
  if (args.example !== undefined && args.example !== "blank") retired("--example")
}

// Mirrors npm's own unscoped package name rule, kept intentionally loose.
function isValidName(name) {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name || "")
}

function titleCase(name) {
  return name
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ")
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") && a.includes("=")) {
      const at = a.indexOf("=")
      out[a.slice(2, at)] = a.slice(at + 1)
    } else if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("--")) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

function printHelp() {
  console.log(HELP)
}

/** The placeholder-identity edits every scaffold gets, whichever verb produced it. */
function applyIdentityEdits(target, rawName) {
  const title = titleCase(rawName)
  const edits = [
    ["package.json", [["grist-widget-template-vite", rawName]]],
    ["README.md", [["grist-widget-template-vite", rawName]]],
    ["CHANGELOG.md", [["grist-widget-template-vite", rawName]]],
    ["index.html", [["<title>Grist Widget</title>", `<title>${title}</title>`]]],
    ["src/app/App.tsx", [['title: "Grist Widget Template",', `title: "${title}",`]]],
    // The page's title and the demo section's (which the page writes into the document).
    ["public/demo/index.html", [["Grist Widget Template", title]]],
  ]
  for (const [file, subs] of edits) {
    const p = path.join(target, file)
    if (!existsSync(p)) continue
    let content = readFileSync(p, "utf8")
    for (const [search, replace] of subs) content = content.split(search).join(replace)
    if (file === "README.md") content = stripTemplateOnly(content)
    writeFileSync(p, content)
  }
  return title
}

// npm strips a literal `.gitignore` from the published package (see
// scripts/build-template.mjs), so it ships as `_gitignore` — restore the real name.
function restoreGitignore(target) {
  const gitignorePath = path.join(target, "_gitignore")
  if (existsSync(gitignorePath)) renameSync(gitignorePath, path.join(target, ".gitignore"))
}

// Purely informational (a small landing-page footer), never read by the
// deploy pipeline's own version/release logic.
function stampCreateGristWidgetVersion(target) {
  const pkgJsonPath = path.join(target, "package.json")
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8"))
  pkgJson.createGristWidgetVersion = cliPkg.version
  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n")
}

/** Initialize git on `main` with a first commit and a `dev` branch, if a git identity is configured. */
function gitInitCommit(target) {
  function git(args) {
    execFileSync("git", args, { cwd: target, stdio: "ignore" })
  }
  try {
    git(["init", "-q", "-b", "main"])
    git(["add", "-A"])
    git(["commit", "-q", "-m", "scaffold: initial widget"])
    git(["branch", "dev"])
    return true
  } catch {
    // No git identity configured (or git unavailable) — leave it to the
    // printed next steps.
    return false
  }
}

// Package managers are .cmd shims on Windows, which only a shell starts. The
// shell would interpret metacharacters, so on Windows every argument must be a
// plain word (a package name, a flag): anything else is refused, not quoted.
const PLAIN_ARG = /^[A-Za-z0-9@/._:=+-]+$/
function runCommand(cmd, args, options) {
  if (process.platform === "win32") {
    const unsafe = [cmd, ...args].find((a) => !PLAIN_ARG.test(a))
    if (unsafe !== undefined) throw new Error(`refusing to pass ${JSON.stringify(unsafe)} to the Windows shell`)
    return execSync([cmd, ...args].join(" "), options)
  }
  return execFileSync(cmd, args, options)
}

function hasCommand(cmd) {
  try {
    runCommand(cmd, ["--version"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

/** Returns whether the install ran, and why not when it was skipped. */
function maybeInstall(target, { noInstall, pm }) {
  const plan = installPlan({ noInstall, pm, hasPnpm: () => hasCommand("pnpm") })
  if (plan.skip) return { installed: false, skipped: plan.skip }
  try {
    runCommand(plan.manager, ["install"], { cwd: target, stdio: "inherit" })
    return { installed: true }
  } catch {
    console.warn(`\nCould not run "${plan.manager} install" automatically — run it yourself.`)
    return { installed: false }
  }
}

/**
 * Install (unless --no-install, or pnpm is missing), returning which
 * `minimumReleaseAgeExclude` entries pnpm added to pnpm-workspace.yaml along
 * the way. Runs before the first commit, so the lockfile -- and those
 * entries, without which every later install rejects that lockfile -- are
 * part of it.
 */
function installBeforeFirstCommit(target, args) {
  const workspaceFile = path.join(target, "pnpm-workspace.yaml")
  const read = () => (existsSync(workspaceFile) ? readFileSync(workspaceFile, "utf8") : "")
  const before = read()
  const { installed, skipped } = maybeInstall(target, {
    noInstall: Boolean(args["no-install"]),
    pm: typeof args.pm === "string" ? args.pm : null,
  })
  return { installed, skipped, ageExceptions: installed ? addedAgeExceptions(before, read()) : [] }
}

function printNoPnpmNote(skipped) {
  if (skipped !== "no-pnpm") return
  console.log(
    "\nNote: dependencies were not installed. This widget uses pnpm (its workflows install with it," +
      "\nand only read pnpm-lock.yaml), and pnpm isn't installed. Install it (https://pnpm.io/installation)," +
      "\nthen run `pnpm install` and commit pnpm-lock.yaml."
  )
}

function printAgeExceptionsNote(ageExceptions) {
  if (ageExceptions.length === 0) return
  console.log(
    `\nNote: ${ageExceptions.join(", ")} came out less than 24 hours ago. pnpm only installs versions` +
      "\nthat recent when told to, so it listed them under minimumReleaseAgeExclude in pnpm-workspace.yaml." +
      "\nThat entry is committed: without it, every later install (yours and CI's) rejects the lockfile." +
      "\nIt only covers the SDK and CLI versions this scaffold was made with, and is moot once a day old."
  )
}

function listFilesRecursive(dir, base = dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, base))
    else out.push(path.relative(base, full).split(path.sep).join("/"))
  }
  return out
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

async function cmdCreate(argv) {
  const args = parseArgs(argv)
  refuseExample(args)
  const interactive = Boolean(process.stdout.isTTY) && !args.yes && !args._[0]

  let rawName = args._[0]

  if (interactive) {
    clack.intro("create-grist-widget")
    if (!rawName) {
      const nameAnswer = await clack.text({
        message: "Widget name",
        placeholder: "my-widget",
        validate: (v) => (isValidName(v) ? undefined : "lowercase letters, digits, hyphens only"),
      })
      if (clack.isCancel(nameAnswer)) {
        clack.cancel("Cancelled.")
        process.exit(1)
      }
      rawName = nameAnswer
    }
    clack.outro("Scaffolding...")
  }

  if (!rawName) {
    console.error("Usage: npm create grist-widget <widget-name> [--yes] [--no-install] [--pm <pm>]")
    process.exit(1)
  }
  if (!isValidName(rawName)) {
    console.error(`"${rawName}" is not a valid name — use lowercase letters, digits, and hyphens.`)
    process.exit(1)
  }

  const target = path.resolve(process.cwd(), rawName)
  if (existsSync(target) && readdirSync(target).length > 0) {
    console.error(`"${rawName}" already exists and is not empty.`)
    process.exit(1)
  }
  mkdirSync(target, { recursive: true })
  cpSync(TEMPLATE_DIR, target, { recursive: true })
  restoreGitignore(target)
  applyIdentityEdits(target, rawName)

  stampCreateGristWidgetVersion(target)

  // Install first, so the first commit includes the lockfile (pinned, with
  // integrity hashes; pnpm then freezes installs in CI by itself).
  const { installed, skipped, ageExceptions } = installBeforeFirstCommit(target, args)
  const committed = gitInitCommit(target)

  printAgeExceptionsNote(ageExceptions)
  printNoPnpmNote(skipped)
  console.log(`\nCreated ${rawName}/\n`)
  console.log(`  cd ${rawName}`)
  if (!installed) console.log("  pnpm install")
  console.log("  pnpm dev")
  if (committed) {
    console.log("\nGit is initialized on main (first commit done) with a dev branch ready.")
    console.log("To push to GitHub:")
    console.log("  git remote add origin https://github.com/<owner>/<repo>.git")
    console.log("  git push -u origin main")
    console.log("  git push origin dev   # optional, for the live-preview channel")
  } else {
    console.log("\nCould not create the initial git commit automatically (no git identity")
    console.log('configured?) — run `git config user.name`/`user.email`, then:')
    console.log("  git init -b main && git add -A && git commit -m 'scaffold: initial widget'")
    console.log("  git branch dev")
  }
}

// ---------------------------------------------------------------------------
// init
// ---------------------------------------------------------------------------

async function cmdInit(argv) {
  const args = parseArgs(argv)
  refuseExample(args)
  const cwd = process.cwd()

  const interactive = Boolean(process.stdout.isTTY) && !args.yes
  if (interactive) {
    clack.intro("create-grist-widget init")
    clack.outro("Initializing...")
  }

  const rawName = typeof args.name === "string" ? args.name : path.basename(cwd)
  if (!isValidName(rawName)) {
    console.error(
      `"${rawName}" is not a valid widget name (derived from the current directory) — pass --name.`
    )
    process.exit(1)
  }

  // File-collision policy: identity-bearing files always get edited in place
  // (naturally a no-op wherever the placeholder text is already gone — the
  // common case, a pristine "Use this template" clone); anything else that
  // already exists and differs from the template's own pristine copy blocks
  // the run, listed, unless --force.
  const IDENTITY_FILES = new Set(["package.json", "README.md", "CHANGELOG.md", "index.html", "src/app/App.tsx"])
  const templateFiles = listFilesRecursive(TEMPLATE_DIR)
  if (!args.force) {
    const conflicts = []
    for (const rel of templateFiles) {
      if (IDENTITY_FILES.has(rel)) continue
      const destPath = path.join(cwd, rel)
      if (!existsSync(destPath)) continue
      const same = readFileSync(path.join(TEMPLATE_DIR, rel)).equals(readFileSync(destPath))
      if (!same) conflicts.push(rel)
    }
    if (conflicts.length > 0) {
      console.error(
        `init: refusing to overwrite the following files (already exist and differ from the template) — remove them or re-run with --force:\n` +
          conflicts.map((f) => `  ${f}`).join("\n")
      )
      process.exit(1)
    }
  }

  for (const rel of templateFiles) {
    const destPath = path.join(cwd, rel)
    mkdirSync(path.dirname(destPath), { recursive: true })
    cpSync(path.join(TEMPLATE_DIR, rel), destPath)
  }
  restoreGitignore(cwd)
  applyIdentityEdits(cwd, rawName)

  stampCreateGristWidgetVersion(cwd)

  // Never auto-commit into a pre-existing repo's history — only take over
  // git entirely when cwd had none to begin with (a fresh, non-git directory,
  // or a real git clone where .git already carries whatever history it has).
  const gitAlreadyExists = existsSync(path.join(cwd, ".git"))
  // Install first, so a first commit includes the lockfile (see cmdCreate).
  const { installed, skipped, ageExceptions } = installBeforeFirstCommit(cwd, args)
  const committed = gitAlreadyExists ? false : gitInitCommit(cwd)

  printAgeExceptionsNote(ageExceptions)
  printNoPnpmNote(skipped)
  console.log(`\nInitialized ${rawName}/ in the current directory.\n`)
  if (!installed) console.log("  pnpm install")
  console.log("  pnpm dev")
  if (gitAlreadyExists) {
    console.log("\nExisting git repository detected — no commit was made automatically.")
    console.log("Review the changes (git status) and commit when ready.")
  } else if (committed) {
    console.log("\nGit is initialized on main (first commit done) with a dev branch ready.")
  } else {
    console.log("\nCould not create the initial git commit automatically (no git identity")
    console.log('configured?) — run `git config user.name`/`user.email`, then commit yourself.')
  }
}

// ---------------------------------------------------------------------------
// manifest
// ---------------------------------------------------------------------------

async function cmdManifest(argv) {
  const opts = { dist: "dist", base: null, ownerRepo: process.env.GITHUB_REPOSITORY ?? null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dist") opts.dist = argv[++i]
    else if (argv[i] === "--base") opts.base = argv[++i]
    else if (argv[i] === "--owner-repo") opts.ownerRepo = argv[++i]
    else {
      console.error(`manifest: unknown argument ${JSON.stringify(argv[i])}`)
      process.exit(2)
    }
  }
  if (!opts.base || !opts.ownerRepo) {
    console.error("Usage: create-grist-widget manifest --base <path> [--dist dist] [--owner-repo owner/repo]\n(--owner-repo defaults to $GITHUB_REPOSITORY, set in GitHub Actions)")
    process.exit(2)
  }
  const cwd = process.cwd()
  const manifest = await writeManifest({
    widgetDir: cwd,
    distDir: path.resolve(cwd, opts.dist),
    base: opts.base,
    ownerRepo: opts.ownerRepo,
    cliVersion: cliPkg.version,
  })
  console.log(`Wrote ${path.join(opts.dist, MANIFEST_FILE)}:`)
  console.log(JSON.stringify(manifest, null, 2))
}

// ---------------------------------------------------------------------------
// demo
// ---------------------------------------------------------------------------

async function cmdDemo(argv) {
  let args
  try {
    args = demoArgs(argv)
  } catch (e) {
    console.error(e.message)
    process.exit(2)
  }
  const cwd = process.cwd()
  const refusal = demoRefusal(cwd)
  if (refusal) {
    console.error(refusal)
    process.exit(1)
  }
  if (args.save) {
    const { dir } = await saveDemo({ cwd, gristPort: args.gristPort })
    console.log(`\nWrote ${path.relative(cwd, dir)}/demo.grist and index.html: the widget in a real Grist, from static files.`)
    console.log(`Commit them. Every build then serves <channel>/demo/ next to the widget, e.g. .../latest/demo/.`)
    console.log(`To change the demo data, open ${DEMO_DIR}/demo.grist in any Grist, edit it, and download it back over the file.`)
    return
  }
  const { url, stop } = await runDemo({ cwd, gristPort: args.gristPort })
  console.log(`\nYour widget, in a real Grist (no account, local only):\n\n  ${url}\n`)
  console.log("Edits reload in place. The document is regenerated on every run. Ctrl-C stops Grist and the dev server.")
  const shutdown = () => {
    stop().finally(() => process.exit(0))
  }
  process.once("SIGINT", shutdown)
  process.once("SIGTERM", shutdown)
}

// ---------------------------------------------------------------------------
// upgrade
// ---------------------------------------------------------------------------

const CLI_CHANGELOG_URL =
  "https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/packages/create-grist-widget/CHANGELOG.md"

/** When `name@version` was published, from the registry `npm` is configured for in `cwd`; null if unknown. */
function npmPublishTimes(cwd) {
  const cache = new Map()
  return (name, version) => {
    if (!cache.has(name)) {
      let times = null
      try {
        const out = runCommand("npm", ["view", name, "time", "--json"], {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 30_000,
        })
        times = JSON.parse(out)
      } catch {
        // Offline, or not on that registry: the entry stays.
      }
      cache.set(name, times)
    }
    const at = cache.get(name)?.[version]
    return at ? new Date(at) : null
  }
}

function printList(title, items) {
  if (items.length === 0) return
  console.log(`\n${title}`)
  for (const item of items) console.log(`  ${item}`)
}

function cmdProtect(argv) {
  const dryRun = argv.includes("--dry-run")
  let result
  try {
    result = runProtect(process.cwd(), { templateDir: TEMPLATE_DIR, dryRun })
  } catch (err) {
    console.error(`protect: ${err.message}`)
    process.exit(1)
  }
  const { repo, plan, done } = result
  console.log(`${repo}${dryRun ? " (dry run: nothing changed)" : ""}:`)
  for (const name of plan.keep) console.log(`  ruleset "${name}": already there, left as it is`)
  if (dryRun) {
    for (const r of plan.create) console.log(`  ruleset "${r.name}": would be created`)
    if (plan.reporting === "enable") console.log("  private vulnerability reporting: would be turned on")
    if (plan.pages === "enable") console.log("  GitHub Pages: would be turned on, from gh-pages")
  } else {
    for (const line of done) console.log(`  ${line}`)
  }
  if (plan.reporting === "ok") console.log("  private vulnerability reporting: already on")
  if (plan.pages === "ok") console.log("  GitHub Pages: served from gh-pages")
  if (plan.pages === "mismatch")
    console.log("  GitHub Pages: on, but not from gh-pages at / — set it in Settings → Pages (left as it is)")
}

function cmdRelease(argv) {
  const bump = argv.find((a) => !a.startsWith("-"))
  if (!BUMPS.includes(bump)) {
    console.error(`Usage: pnpm release <${BUMPS.join("|")}>  (on dev; see https://gristwidgets.com/docs/cli/releasing)`)
    process.exit(1)
  }
  let result
  try {
    result = runRelease(process.cwd(), bump)
  } catch (err) {
    console.error(`release: ${err.message}`)
    process.exit(1)
  }
  console.log(`Committed release v${result.version} on dev:`)
  for (const line of result.lines) console.log(`  - ${line}`)
  console.log("\nNext:")
  console.log("  git push origin dev")
  console.log(
    result.compareUrl
      ? `  then open the dev → main pull request: ${result.compareUrl}`
      : "  then open the dev → main pull request"
  )
  console.log("Merging it publishes /v" + result.version + "/ and /latest/.")
}

function cmdUpgrade(argv) {
  const args = parseArgs(argv)
  const cwd = process.cwd()
  const refusal = upgradeRefusal(cwd, { cliVersion: cliPkg.version, templateDir: TEMPLATE_DIR, force: args.force === true })
  if (refusal) {
    console.error(refusal.message)
    process.exit(1)
  }

  const report = runUpgrade({
    cwd,
    templateDir: TEMPLATE_DIR,
    cliVersion: cliPkg.version,
    publishedAt: npmPublishTimes(cwd),
  })
  const changed =
    report.written.length +
      report.deleted.length +
      report.tsconfigs.length +
      report.packageChanges.length +
      report.ageRemoved.length +
      report.codemods.length >
    0

  const from = report.fromVersion && report.fromVersion !== cliPkg.version ? ` (from ${report.fromVersion})` : ""
  if (!changed) {
    console.log(`Already on create-grist-widget ${cliPkg.version}'s template: nothing to change.`)
  } else {
    console.log(`Upgraded to create-grist-widget ${cliPkg.version}'s template${from}.`)
  }
  printList("Template files rewritten:", report.written)
  printList("Deleted (earlier templates wrote them, nothing uses them now):", report.deleted)
  printList(
    "Kept: earlier templates wrote these, but a file of yours still refers to them (delete them once it doesn't):",
    report.keptRetired.map(({ file, by }) => `${file}  (by ${by.join(", ")})`)
  )
  printList(
    "Switched to grist-widget-sdk's compiler settings, keeping these types:",
    report.tsconfigs.map(({ file, types }) => `${file}  (types: ${types.join(", ") || "none"})`)
  )
  printList(
    "Not switched to grist-widget-sdk's compiler settings (could not be read; do it by hand):",
    report.tsconfigsUnreadable
  )
  printList("package.json:", report.packageChanges)
  printList("pnpm age exceptions removed (old enough now that pnpm no longer needs them):", report.ageRemoved)
  printList("pnpm age exceptions kept (their publish time could not be looked up):", report.ageUnknown)
  printList(
    "Deprecated grist-widget-sdk names rewritten in your code:",
    report.codemods.map(({ file, changes }) => `${file}: ${changes.join("; ")}`)
  )
  printList(
    `SDK names left for you to change (${RENAMED_NAMES_URL}):`,
    report.sdkNamesLeft.map(({ file, line, name, hint }) => `${file}:${line}  ${name}: ${hint}`)
  )
  if (!changed) return

  console.log("\nNext:")
  // Only what pnpm-lock.yaml records: dependencies, packageManager, age exceptions.
  const lockfileChanges = report.packageChanges.filter((c) => /^(dependencies|devDependencies|packageManager)\b/.test(c))
  if (lockfileChanges.length || report.ageRemoved.length) {
    console.log("  pnpm install                                # update pnpm-lock.yaml")
  }
  console.log("  pnpm typecheck && pnpm lint && pnpm test")
  console.log("  git diff                                    # review, then commit and push dev")
  console.log(
    `\nAnything a template change needs beyond these files is in the changelog entries${from ? ` after ${report.fromVersion}` : ""}:` +
      `\n  ${CLI_CHANGELOG_URL}`
  )
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

async function main() {
  const rawArgv = process.argv.slice(2)
  const [first, ...rest] = rawArgv

  if (first === "--help" || first === "-h") {
    printHelp()
    return
  }
  if (first === "--version" || first === "-v") {
    console.log(cliPkg.version)
    return
  }
  if (first === "list" || first === "use")
    return retired(`create-grist-widget ${first}`, ` For a widget named "${first}", run: create-grist-widget create ${first}`)
  if (first === "upgrade") return cmdUpgrade(rest)
  if (first === "demo") return cmdDemo(rest)
  if (first === "release") return cmdRelease(rest)
  if (first === "protect") return cmdProtect(rest)
  if (first === "manifest") return cmdManifest(rest)
  if (first === "init") return cmdInit(rest)
  if (first === "create") return cmdCreate(rest)
  // Bare invocation — `npm create grist-widget my-widget` (npm's `create`
  // convention passes argv straight through, no `create` keyword), or no
  // args at all (interactive). Treat the whole argv as arguments to `create`.
  return cmdCreate(rawArgv)
}

main().catch((err) => {
  console.error(err?.stack || String(err))
  process.exit(1)
})
