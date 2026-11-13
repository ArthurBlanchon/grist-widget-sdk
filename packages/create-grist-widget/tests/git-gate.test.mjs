// The one unit test docs/history/2026-08-08-execution-plan.md §105 calls out
// by name ("the git gate has its own test") — independent of and faster
// than the full scripts/smoke/create-widget.sh, which separately exercises
// `use` end to end against a packed tarball.
//
// Exercises the real `git` binary against real tmpdirs (matches this repo's
// general preference for real git over mocking it — see
// scripts/smoke/create-widget.sh's own git assertions).

import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { checkGitGate } from "../src/git-gate.mjs"

const dirs = []

function makeTmpDir() {
  const dir = mkdtempSync(join(tmpdir(), "cgw-git-gate-"))
  dirs.push(dir)
  return dir
}

// Same fix scripts/smoke/create-widget.sh already applies for CI runners
// with no global git identity configured.
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
}

function git(args, cwd) {
  execFileSync("git", args, { cwd, stdio: "ignore", env: GIT_ENV })
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop(), { recursive: true, force: true })
})

describe("checkGitGate", () => {
  it("reports no-repo when cwd is not inside a git work tree", () => {
    const dir = makeTmpDir()
    expect(checkGitGate(dir)).toEqual({ ok: false, reason: "no-repo" })
  })

  it("reports ok when the tree is clean", () => {
    const dir = makeTmpDir()
    git(["init", "-q", "-b", "main"], dir)
    writeFileSync(join(dir, "file.txt"), "hello\n")
    git(["add", "-A"], dir)
    git(["commit", "-q", "-m", "initial"], dir)
    expect(checkGitGate(dir)).toEqual({ ok: true })
  })

  it("reports dirty when there are uncommitted changes", () => {
    const dir = makeTmpDir()
    git(["init", "-q", "-b", "main"], dir)
    writeFileSync(join(dir, "file.txt"), "hello\n")
    git(["add", "-A"], dir)
    git(["commit", "-q", "-m", "initial"], dir)
    writeFileSync(join(dir, "file.txt"), "changed\n")
    expect(checkGitGate(dir)).toEqual({ ok: false, reason: "dirty" })
  })
})
