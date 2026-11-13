// The safety gate `use <example-id>` rests on: overlayExampleSrc replaces
// src/app/ (the widget's own folder) with the example's files, so the only
// thing that makes that recoverable is a clean git tree to diff/revert
// against. `create`/`init` always leave a repo behind today (see
// bin/create-grist-widget.mjs's gitInitCommit), but `use` checks for one
// explicitly rather than assuming it — the plan's own Done-when line calls
// this out: "it rests on the CLI's git init, which a future --no-git would
// silently remove." Checking `git rev-parse` (not just "does .git exist")
// is what keeps this correct independent of that future flag.
//
// Exported separately from bin/create-grist-widget.mjs so it has its own
// unit test (tests/git-gate.test.mjs) — see docs/history/2026-08-08-execution-plan.md
// §105 ("the git gate has its own test").

import { execFileSync } from "node:child_process"

/**
 * @param {string} cwd
 * @returns {{ ok: true } | { ok: false, reason: "no-repo" | "dirty" }}
 */
export function checkGitGate(cwd) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, stdio: "pipe" })
  } catch {
    return { ok: false, reason: "no-repo" }
  }
  const status = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" })
  if (status.trim()) return { ok: false, reason: "dirty" }
  return { ok: true }
}
