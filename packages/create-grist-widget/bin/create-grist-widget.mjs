#!/usr/bin/env node
// create-grist-widget — scaffold a Grist custom widget, fully offline.
//
// Five verbs (batch H, docs/history/2026-08-08-execution-plan.md §98-105, and
// T2 of docs/history/2026-11-01-widget-lifecycle-plan.md):
//   create <name> [--example <id>]   scaffold a new widget into ./<name>
//   init [--example <id>]            scaffold into the current directory
//   use <example-id>                 swap the current project's widget (src/app/)
//   upgrade                          bring the template's files up to this CLI's
//   demo [--save] [--port <n>]       the widget in a real Grist on this machine (Docker);
//                                    --save writes its static demo into public/demo/
//   release <patch|minor|major>      the release commit on dev (version, CHANGELOG.md)
//   manifest --base <path>           write dist/grist-widget.json (the deploy workflow's build job)
//   list [--json]                    print the available starting examples
//
// `create`/`init`/`use` share one compose engine — see
// packages/create-grist-widget/vendor/compose-example.mjs (a verbatim,
// path-free copy of scripts/compose-example.mjs, embedded by
// scripts/build-template.mjs alongside the template itself, along with
// examples/, ui-source/, and manifest.json — see that script for why).
// Nothing here ever hits the network: everything list/use/create --example
// need already shipped in the tarball. The one exception is `upgrade`, which
// asks the npm registry when versions in pnpm's age exceptions were published,
// and `demo`, which runs Grist from a Docker image.

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

import { createComposer } from "../vendor/compose-example.mjs"
import { checkGitGate } from "../src/git-gate.mjs"
import { addedAgeExceptions } from "../src/age-exceptions.mjs"
import { installPlan } from "../src/package-manager.mjs"
import { DEPRECATED_URL } from "../src/codemods.mjs"
import { runUpgrade, upgradeRefusal } from "../src/upgrade.mjs"
import { BUMPS, runRelease } from "../src/release.mjs"
import { DEMO_DIR, demoArgs, demoRefusal, runDemo, saveDemo } from "../src/demo.mjs"
import { MANIFEST_FILE, writeManifest } from "../src/manifest.mjs"

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const TEMPLATE_DIR = path.join(PKG_ROOT, "template")

const cliPkg = JSON.parse(readFileSync(path.join(PKG_ROOT, "package.json"), "utf8"))

const composer = createComposer({
  templateDir: TEMPLATE_DIR,
  examplesDir: path.join(PKG_ROOT, "examples"),
  uiDir: path.join(PKG_ROOT, "ui-source"),
  manifestPath: path.join(PKG_ROOT, "manifest.json"),
})

function loadManifest() {
  return JSON.parse(readFileSync(path.join(PKG_ROOT, "manifest.json"), "utf8"))
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
    if (a.startsWith("--")) {
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
  console.log(`create-grist-widget — scaffold a Grist custom widget, offline

Usage:
  npm create grist-widget <name> [options]       Scaffold into ./<name>
  create-grist-widget create <name> [options]    Same as above, explicit
  create-grist-widget init [options]             Scaffold into the current directory
  create-grist-widget use <example-id>           Replace the current project's widget (src/app/)
  create-grist-widget upgrade [--force]          Bring the template's files up to this CLI's
                                                 (run it on dev, in a widget: pnpm exec create-grist-widget upgrade);
                                                 --force overwrites a src/main.tsx or file of the widget's own
  create-grist-widget demo [--port <n>]          Open the widget in a real Grist on this machine
                                                 (needs Docker; in a widget: pnpm demo)
  create-grist-widget demo --save                Write public/demo/: the widget's demo page and
                                                 document, a real Grist from static files (Docker)
  create-grist-widget release <patch|minor|major>
                                                 On dev: bump the version, write CHANGELOG.md from
                                                 what dev has that main doesn't, and commit
                                                 (in a widget: pnpm release minor)
  create-grist-widget manifest --base <path>     Write dist/grist-widget.json, the widget's Grist
                                                 manifest (run by the deploy workflow after vite build)
  create-grist-widget list [--json]              List available starting examples

Options (create / init):
  --example <id>   Start from a named example instead of the blank template
                    (see "list" for ids)
  --yes            Skip interactive prompts, use defaults/flags only
  --no-install     Don't run the package manager install automatically
  --pm <name>      Install with this package manager instead of pnpm (the
                    widget's workflows use pnpm and only read its lockfile)
  --name <name>    (init only) Widget name — default: the current directory's name
  --force          (init only) Overwrite files that already exist and differ
                    from the template

  --help, -h       Show this help
  --version, -v    Show this CLI's version

Note: "create", "init", "use", "upgrade", "demo", "release", "manifest", and "list" are themselves valid widget names.
A bare "create-grist-widget list" runs the list command, not "scaffold a
widget named list" — use "create-grist-widget create list" for that.`)
}

/** The placeholder-identity edits every scaffold gets, whichever verb produced it. */
function applyIdentityEdits(target, rawName) {
  const title = titleCase(rawName)
  const edits = [
    ["package.json", [["grist-widget-template-vite", rawName]]],
    ["README.md", [["grist-widget-template-vite", rawName]]],
    ["index.html", [["<title>Grist Widget</title>", `<title>${title}</title>`]]],
    ["src/app/App.tsx", [['title: "Grist Widget Template",', `title: "${title}",`]]],
    ["public/demo/index.html", [["Grist Widget Template — demo", `${title} — demo`]]],
  ]
  for (const [file, subs] of edits) {
    const p = path.join(target, file)
    if (!existsSync(p)) continue
    let content = readFileSync(p, "utf8")
    for (const [search, replace] of subs) content = content.split(search).join(replace)
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

/** Interactive "which example?" picker, shared by `create` and `init` — reads the same manifest.json `list` does. */
async function pickExampleInteractively(manifest) {
  const choice = await clack.select({
    message: "Start from an example?",
    options: [
      { value: null, label: "Blank template (two-field editor)" },
      ...manifest.map((e) => ({ value: e.id, label: e.title, hint: e.description })),
    ],
  })
  if (clack.isCancel(choice)) {
    clack.cancel("Cancelled.")
    process.exit(1)
  }
  return choice
}

function resolveExampleFlag(exampleFlag, manifest) {
  if (exampleFlag === undefined || exampleFlag === true) return { ok: true, exampleId: null }
  if (exampleFlag === "blank") return { ok: true, exampleId: null }
  if (!manifest.some((e) => e.id === exampleFlag)) {
    return { ok: false }
  }
  return { ok: true, exampleId: exampleFlag }
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

async function cmdCreate(argv) {
  const args = parseArgs(argv)
  const manifest = loadManifest()
  const interactive = Boolean(process.stdout.isTTY) && !args.yes && !args._[0]

  let rawName = args._[0]
  let exampleId = null

  if (args.example !== undefined) {
    const resolved = resolveExampleFlag(args.example, manifest)
    if (!resolved.ok) {
      console.error(`Unknown example "${args.example}". Run "create-grist-widget list" to see available examples.`)
      process.exit(1)
    }
    exampleId = resolved.exampleId
  }

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
    if (args.example === undefined) {
      exampleId = await pickExampleInteractively(manifest)
    }
    clack.outro("Scaffolding...")
  }

  if (!rawName) {
    console.error("Usage: npm create grist-widget <widget-name> [--example <id>] [--yes] [--no-install] [--pm <pm>]")
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

  if (exampleId) {
    composer.overlayExampleSrc({ exampleId, destDir: target })
    composer.mergeExtraDependencies({ exampleId, destDir: target })
  }

  stampCreateGristWidgetVersion(target)

  // Install first, so the first commit includes the lockfile (pinned, with
  // integrity hashes; pnpm then freezes installs in CI by itself).
  const { installed, skipped, ageExceptions } = installBeforeFirstCommit(target, args)
  const committed = gitInitCommit(target)

  printAgeExceptionsNote(ageExceptions)
  printNoPnpmNote(skipped)
  console.log(`\nCreated ${rawName}/${exampleId ? ` (starting from "${exampleId}")` : ""}\n`)
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
  const manifest = loadManifest()
  const cwd = process.cwd()

  let exampleId = null
  if (args.example !== undefined) {
    const resolved = resolveExampleFlag(args.example, manifest)
    if (!resolved.ok) {
      console.error(`Unknown example "${args.example}". Run "create-grist-widget list" to see available examples.`)
      process.exit(1)
    }
    exampleId = resolved.exampleId
  }

  const interactive = Boolean(process.stdout.isTTY) && !args.yes && args.example === undefined
  if (interactive) {
    clack.intro("create-grist-widget init")
    exampleId = await pickExampleInteractively(manifest)
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
  const IDENTITY_FILES = new Set(["package.json", "README.md", "index.html", "src/app/App.tsx"])
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

  if (exampleId) {
    composer.overlayExampleSrc({ exampleId, destDir: cwd })
    composer.mergeExtraDependencies({ exampleId, destDir: cwd })
  }

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
  console.log(`\nInitialized ${rawName}/${exampleId ? ` (starting from "${exampleId}")` : ""} in the current directory.\n`)
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
// use
// ---------------------------------------------------------------------------

function cmdUse(argv) {
  const args = parseArgs(argv)
  const exampleId = args._[0]
  if (!exampleId) {
    console.error('Usage: create-grist-widget use <example-id>\nRun "create-grist-widget list" to see available examples.')
    process.exit(1)
  }
  const manifest = loadManifest()
  if (!manifest.some((e) => e.id === exampleId)) {
    console.error(`Unknown example "${exampleId}". Run "create-grist-widget list" to see available examples.`)
    process.exit(1)
  }

  const cwd = process.cwd()
  // Scaffolds older than the src/app/ layout keep their widget in src/, and
  // their main.tsx imports ./App.tsx: an example written to src/app/ would
  // never show.
  if (existsSync(path.join(cwd, "src", "App.tsx"))) {
    console.error(
      "use: this project keeps its widget in src/App.tsx. Widgets now live in src/app/: move it there first" +
        " (see https://gristwidgets.com/docs/cli/upgrading), then run use again."
    )
    process.exit(1)
  }
  const gate = checkGitGate(cwd)
  if (!gate.ok) {
    if (gate.reason === "no-repo") {
      console.error(
        'use: this command replaces src/app/ and must run inside a git repository so the change is easy to review and undo. Run "git init" first.'
      )
    } else {
      console.error(
        "use: working tree has uncommitted changes — commit or stash them first, so this swap is easy to diff and undo."
      )
    }
    process.exit(1)
  }

  composer.overlayExampleSrc({ exampleId, destDir: cwd })
  const { merged } = composer.mergeExtraDependencies({ exampleId, destDir: cwd })

  console.log(`Swapped in "${exampleId}".`)
  console.log("\n  git diff       # review what changed")
  if (merged) console.log("  pnpm install   # new dependencies were added")
  console.log("  pnpm dev")
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
    `Deprecated names left for you to change (${DEPRECATED_URL}):`,
    report.deprecatedLeft.map(({ file, line, name, hint }) => `${file}:${line}  ${name}: ${hint}`)
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
// list
// ---------------------------------------------------------------------------

function cmdList(argv) {
  const args = parseArgs(argv)
  const manifest = loadManifest()

  if (args.json) {
    // A projected, public subset — not the raw manifest, which carries
    // monorepo-internal fields (columns, usesUi, sourcePath,
    // hasExampleDocument) that shouldn't become an accidental CLI contract.
    const projected = manifest.map((e) => ({ id: e.id, title: e.title, description: e.description }))
    console.log(JSON.stringify(projected, null, 2))
    return
  }

  const idWidth = Math.max(2, ...manifest.map((e) => e.id.length))
  for (const e of manifest) {
    console.log(`${e.id.padEnd(idWidth)}  ${e.title} — ${e.description}`)
  }
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
  if (first === "list") return cmdList(rest)
  if (first === "use") return cmdUse(rest)
  if (first === "upgrade") return cmdUpgrade(rest)
  if (first === "demo") return cmdDemo(rest)
  if (first === "release") return cmdRelease(rest)
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
