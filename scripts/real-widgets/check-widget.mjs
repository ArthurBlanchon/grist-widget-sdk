#!/usr/bin/env node
// Check one real widget against this repo's packed SDK and CLI (plan R3,
// docs/history/2026-11-01-widget-lifecycle-plan.md).
//
//   node scripts/real-widgets/check-widget.mjs <owner/repo> --sdk <sdk.tgz> [--cli <cli.tgz>]
//        [--branch dev] [--work <dir>] [--e2e]
//
// 1. Clone the widget's branch (dev by default, where changes land first;
//    the default branch when the widget has no such branch).
// 2. Point grist-widget-sdk (and create-grist-widget, when the widget depends
//    on it) at the packed tarballs: `file:` dependencies, so pnpm's 24 h
//    age check doesn't apply to them; every other dependency stays as the
//    widget's lockfile pins it.
// 3. Typecheck, test and build. Lint stays out: a widget's lint debt isn't
//    the SDK's.
// 4. If a step fails, run the same steps on a fresh clone with the
//    published versions its lockfile pins. A failure there too means the
//    widget was already failing: reported, not a regression (exit 0). Only a
//    failure the published versions don't have is a regression (exit 1).
// 5. --e2e: also run the packed build in a real Grist (e2e-grist.mjs).
//
// It runs the widget's own code, so CI runs it only for the repos listed in
// widgets.json, with a read-only token and no secrets.

import { execFileSync } from "node:child_process"
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const out = { repo: null, sdk: null, cli: null, branch: "dev", work: path.resolve("real-widgets-work"), e2e: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--sdk") out.sdk = path.resolve(argv[++i])
    else if (a === "--cli") out.cli = path.resolve(argv[++i])
    else if (a === "--branch") out.branch = argv[++i]
    else if (a === "--work") out.work = path.resolve(argv[++i])
    else if (a === "--e2e") out.e2e = true
    else out.repo = a
  }
  return out
}

function run(cmd, args, cwd) {
  console.log(`\n$ ${[cmd, ...args].join(" ")}   (${path.basename(cwd)})`)
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, CI: "true" } })
}

function clone(repo, branch, dir) {
  rmSync(dir, { recursive: true, force: true })
  const url = `https://github.com/${repo}.git`
  const hasBranch = execFileSync("git", ["ls-remote", "--heads", url, branch], { encoding: "utf8" }).trim() !== ""
  if (!hasBranch) console.log(`${repo} has no ${branch} branch: checking its default branch.`)
  run("git", ["clone", "--quiet", "--depth", "1", ...(hasBranch ? ["--branch", branch] : []), url, dir], path.dirname(dir))
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim()
}

/** Point the SDK (and the CLI, if the widget uses it) at the tarballs; returns which it changed. */
function useTarballs(dir, { sdk, cli }) {
  const file = path.join(dir, "package.json")
  const pkg = JSON.parse(readFileSync(file, "utf8"))
  const changed = []
  for (const [name, tarball] of [["grist-widget-sdk", sdk], ["create-grist-widget", cli]]) {
    if (!tarball) continue
    for (const section of ["dependencies", "devDependencies"]) {
      if (pkg[section]?.[name]) {
        pkg[section][name] = `file:${tarball}`
        changed.push(name)
      }
    }
  }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n")
  return changed
}

/** Install, then typecheck / test / build; the first failing step, or null. */
function checks(dir, { frozen }) {
  const steps = [
    ["install", "pnpm", ["install", frozen ? "--frozen-lockfile" : "--no-frozen-lockfile"]],
    ["typecheck", path.join(dir, "node_modules/.bin/tsc"), ["-b"]],
    ["test", "pnpm", ["run", "test"]],
    ["build", "pnpm", ["run", "build"]],
  ]
  for (const [name, cmd, args] of steps) {
    try {
      run(cmd, args, dir)
    } catch {
      return name
    }
  }
  return null
}

function summary(lines) {
  console.log("\n" + lines.join("\n"))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n\n")
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.repo || !args.sdk) {
    console.error("Usage: check-widget.mjs <owner/repo> --sdk <sdk.tgz> [--cli <cli.tgz>] [--branch dev] [--work <dir>] [--e2e]")
    process.exit(2)
  }
  mkdirSync(args.work, { recursive: true })
  const name = args.repo.split("/")[1]
  const packedDir = path.join(args.work, `${name}-packed`)
  const sha = clone(args.repo, args.branch, packedDir)
  const changed = useTarballs(packedDir, args)
  const head = `#### ${args.repo}@${args.branch} (${sha.slice(0, 7)})`

  const failed = checks(packedDir, { frozen: false })
  if (!failed) {
    let e2e = ""
    if (args.e2e) {
      try {
        run("node", [path.join(HERE, "e2e-grist.mjs"), packedDir, "--out", path.join(args.work, "screenshots")], args.work)
        e2e = "; renders in a real Grist"
      } catch {
        summary([head, `**Fails in a real Grist** with this SDK (typecheck, test and build pass). See the screenshot artifact.`])
        process.exit(1)
      }
    }
    summary([head, `Passes with the packed ${changed.join(" and ")}: typecheck, test, build${e2e}.`])
    return
  }

  // Is it this change, or was the widget already failing?
  const publishedDir = path.join(args.work, `${name}-published`)
  clone(args.repo, args.branch, publishedDir)
  const baseline = checks(publishedDir, { frozen: true })
  if (baseline) {
    summary([
      head,
      `Already failing with the published versions (at \`${baseline}\`), and at \`${failed}\` with the packed ones: not counted as a regression.`,
    ])
    return
  }
  summary([head, `**Regression:** \`${failed}\` fails with the packed ${changed.join(" and ")}, and passes with the published versions.`])
  process.exit(1)
}

main()
