#!/usr/bin/env node
// Fails if an AGENTS.md names a script or path that doesn't exist — the
// mechanism batch B (docs/history/2026-08-08-execution-plan.md) adds so the
// file every agent reads first can't silently go stale (see A-01/A-04: the
// deleted Cursor rule went unnoticed for exactly this reason).
//
// Scope is deliberately narrow: only the "## Commands" and "## Path map"
// tables in each AGENTS.md are checked. Everything else (Decision tree,
// Hand-off checklist, and especially Anti-patterns, which intentionally
// names a *forbidden* path like `grist-widget-sdk/src/…`) is prose, not a
// claim of what exists, and checking it would produce false failures.
//
// Usage: node scripts/check-agents-md.mjs [agentsMdPath...]
// Defaults to every AGENTS.md this batch ships.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const defaultTargets = [
  join(repoRoot, "AGENTS.md"),
  join(repoRoot, "templates/grist-widget-template-vite/AGENTS.md"),
]

const targets = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => resolve(p))
  : defaultTargets

/** Recursively find every package.json (skipping node_modules/dist/.git), name -> directory. */
function findWorkspacePackages(root) {
  const byName = new Map()

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") {
        continue
      }
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.name !== "package.json") continue
      try {
        const pkg = JSON.parse(readFileSync(full, "utf8"))
        if (pkg.name) byName.set(pkg.name, dirname(full))
      } catch {
        // Not JSON-parseable — not a package.json we care about.
      }
    }
  }

  walk(root)
  return byName
}

/** Backtick-quoted spans in a line, e.g. "`pnpm build:www`" -> "pnpm build:www". */
function extractBacktickSpans(line) {
  const spans = []
  const re = /`([^`]+)`/g
  let match
  while ((match = re.exec(line))) spans.push(match[1])
  return spans
}

/** Lines of one `## Heading` section (exclusive of the next `## `), or []. */
function extractSection(lines, heading) {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  return end === -1 ? rest : rest.slice(0, end)
}

/** Only markdown table rows (skip the header separator `| --- | --- |`). */
function tableRows(lines) {
  return lines.filter((line) => line.trim().startsWith("|") && !/^\|[\s:-]+\|/.test(line.trim()))
}

function checkCommand(command, packagesByName, baseDir, errors, sourceFile) {
  const parts = command.trim().split(/\s+/)
  if (parts[0] !== "pnpm" && parts[0] !== "npm") return

  if (parts[0] === "npm" && parts[1] === "create" && parts[2] === "grist-widget") {
    const bin = join(repoRoot, "packages/create-grist-widget/bin/create-grist-widget.mjs")
    if (!existsSync(bin)) {
      errors.push(`${sourceFile}: \`${command}\` — ${relative(repoRoot, bin)} does not exist`)
    }
    return
  }

  if (parts[0] !== "pnpm") return

  // Bare `pnpm <script>` (no --filter) means "run from this file's own
  // directory" — that's the repo root when checking the monorepo's
  // AGENTS.md, but the template's own package.json when checking the
  // template's (a scaffold has no workspace to filter into).
  let pkgDir = baseDir
  let scriptIndex = 1

  if (parts[1] === "--filter") {
    const pkgName = parts[2]
    const dir = packagesByName.get(pkgName)
    if (!dir) {
      errors.push(`${sourceFile}: \`${command}\` — no workspace package named "${pkgName}"`)
      return
    }
    pkgDir = dir
    scriptIndex = 3
  }

  const next = parts[scriptIndex]
  // `pnpm exec <bin>` runs a binary directly, not a package.json script —
  // nothing to look up.
  if (!next || next === "exec" || next === "install") return

  const pkgJsonPath = join(pkgDir, "package.json")
  if (!existsSync(pkgJsonPath)) {
    errors.push(`${sourceFile}: \`${command}\` — ${relative(repoRoot, pkgJsonPath)} does not exist`)
    return
  }
  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"))
  if (!pkg.scripts?.[next]) {
    errors.push(
      `${sourceFile}: \`${command}\` — no "${next}" script in ${relative(repoRoot, pkgJsonPath)}`
    )
  }
}

function checkPath(pathSpan, baseDir, errors, sourceFile) {
  // Skip spans that aren't really a bare path: commands (have a space),
  // URLs, and placeholders like `<path>`.
  if (/\s/.test(pathSpan) || /^https?:\/\//.test(pathSpan) || pathSpan.includes("<")) return

  const resolved = resolve(baseDir, pathSpan)
  if (!existsSync(resolved)) {
    errors.push(`${sourceFile}: \`${pathSpan}\` does not exist (resolved to ${relative(repoRoot, resolved)})`)
  }
}

function checkFile(path) {
  const errors = []
  if (!existsSync(path)) {
    return [`${relative(repoRoot, path)}: file does not exist`]
  }

  const content = readFileSync(path, "utf8")
  const lines = content.split("\n")
  const baseDir = dirname(path)
  const sourceFile = relative(repoRoot, path)
  const packagesByName = findWorkspacePackages(repoRoot)

  for (const row of tableRows(extractSection(lines, "## Commands"))) {
    for (const span of extractBacktickSpans(row)) {
      checkCommand(span, packagesByName, baseDir, errors, sourceFile)
    }
  }

  for (const row of tableRows(extractSection(lines, "## Path map"))) {
    // The "Path" column is whichever cell isn't the concept name — check
    // every backtick span in the row rather than trying to pick a column
    // index, since some rows (e.g. "Changelog") mix a command and paths.
    for (const span of extractBacktickSpans(row)) {
      if (span.startsWith("pnpm ") || span.startsWith("npm ")) continue
      checkPath(span, baseDir, errors, sourceFile)
    }
  }

  return errors
}

const allErrors = targets.flatMap(checkFile)

if (allErrors.length > 0) {
  console.error("check-agents-md: found stale reference(s):\n")
  for (const line of allErrors) console.error(`  - ${line}`)
  process.exit(1)
}

console.log(`check-agents-md: ${targets.length} file(s) OK`)
