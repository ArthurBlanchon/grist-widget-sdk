import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import {
  changelogEntry,
  changelogLines,
  githubRepoUrl,
  nextVersion,
  releaseRefusal,
  runRelease,
  withEntry,
} from "../src/release.mjs"

describe("nextVersion", () => {
  it("bumps patch, minor and major, dropping a pre-release suffix", () => {
    expect(nextVersion("0.2.0", "patch")).toBe("0.2.1")
    expect(nextVersion("0.2.3", "minor")).toBe("0.3.0")
    expect(nextVersion("0.2.3", "major")).toBe("1.0.0")
    expect(nextVersion("1.0.0-rc.1", "patch")).toBe("1.0.1")
  })

  it("refuses a version or bump it doesn't know", () => {
    expect(() => nextVersion("latest", "patch")).toThrow(/not x\.y\.z/)
    expect(() => nextVersion("1.0.0", "huge")).toThrow(/patch, minor or major/)
  })
})

describe("the changelog", () => {
  it("keeps the merged changes, not merges or earlier release commits", () => {
    expect(
      changelogLines([
        "feat: a timeline view (#21)",
        "Merge pull request #20 from owner/dev",
        "release: v0.2.0",
        "chore: release 0.1.0",
        "chore(deps): bump vite (#19)",
        "",
      ])
    ).toEqual(["feat: a timeline view (#21)", "chore(deps): bump vite (#19)"])
  })

  it("puts the new entry first, under the title", () => {
    const entry = changelogEntry({ version: "0.3.0", date: "2026-11-15", lines: ["feat: x (#3)"] })
    expect(entry).toBe("## 0.3.0 — 2026-11-15\n\n- feat: x (#3)\n")
    const before = "# gantt-widget\n\n## 0.2.0 — 2026-11-12\n\n- feat: y (#2)\n"
    expect(withEntry(before, entry, "gantt-widget")).toBe(
      "# gantt-widget\n\n## 0.3.0 — 2026-11-15\n\n- feat: x (#3)\n\n## 0.2.0 — 2026-11-12\n\n- feat: y (#2)\n"
    )
  })

  it("starts a changelog that doesn't exist yet", () => {
    const entry = changelogEntry({ version: "0.1.1", date: "2026-11-15", lines: ["fix: z"] })
    expect(withEntry("", entry, "my-widget")).toBe("# my-widget\n\n## 0.1.1 — 2026-11-15\n\n- fix: z\n")
  })
})

describe("guards", () => {
  const ok = { branch: "dev", dirty: false, ahead: 0, behind: 0, hasMain: true }
  it("runs on a clean dev, in step with origin, once main exists", () => {
    expect(releaseRefusal(ok)).toBeNull()
    expect(releaseRefusal({ ...ok, branch: "main" })).toMatch(/runs on dev/)
    expect(releaseRefusal({ ...ok, dirty: true })).toMatch(/uncommitted/)
    expect(releaseRefusal({ ...ok, hasMain: false })).toMatch(/first release/)
    expect(releaseRefusal({ ...ok, behind: 2 })).toMatch(/behind origin\/dev/)
    expect(releaseRefusal({ ...ok, ahead: 1 })).toMatch(/push them first/)
  })

  it("reads the GitHub repository from an https or ssh remote", () => {
    expect(githubRepoUrl("https://github.com/owner/gantt-widget.git")).toBe("https://github.com/owner/gantt-widget")
    expect(githubRepoUrl("git@github.com:owner/gantt-widget.git")).toBe("https://github.com/owner/gantt-widget")
    expect(githubRepoUrl("https://gitlab.com/owner/x.git")).toBeNull()
  })
})

describe("runRelease", () => {
  const dirs = []
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
  })
  const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

  /** A widget repo whose dev has two merged changes main doesn't, pushed to a bare origin. */
  function widgetRepo() {
    const root = mkdtempSync(path.join(tmpdir(), "cgw-release-"))
    dirs.push(root)
    const origin = path.join(root, "origin.git")
    const work = path.join(root, "work")
    git(root, "init", "--quiet", "--bare", "-b", "main", origin)
    git(root, "init", "--quiet", "-b", "main", work)
    git(work, "config", "user.name", "Test")
    git(work, "config", "user.email", "test@example.com")
    writeFileSync(path.join(work, "package.json"), JSON.stringify({ name: "gantt-widget", version: "0.2.0" }, null, 2) + "\n")
    git(work, "add", ".")
    git(work, "commit", "--quiet", "-m", "release: v0.2.0")
    git(work, "remote", "add", "origin", origin)
    git(work, "push", "--quiet", "origin", "main")
    git(work, "checkout", "--quiet", "-b", "dev")
    for (const subject of ["feat: a timeline view (#21)", "fix: the week starts on Monday (#22)"]) {
      writeFileSync(path.join(work, "notes.txt"), subject)
      git(work, "add", ".")
      git(work, "commit", "--quiet", "-m", subject)
    }
    git(work, "push", "--quiet", "origin", "dev")
    return work
  }

  it("bumps the version, writes the changelog from dev's changes, and commits", () => {
    const work = widgetRepo()
    const result = runRelease(work, "minor", { today: "2026-11-15" })
    expect(result.version).toBe("0.3.0")
    expect(result.lines).toEqual(["fix: the week starts on Monday (#22)", "feat: a timeline view (#21)"])
    expect(JSON.parse(readFileSync(path.join(work, "package.json"), "utf8")).version).toBe("0.3.0")
    expect(readFileSync(path.join(work, "CHANGELOG.md"), "utf8")).toBe(
      "# gantt-widget\n\n## 0.3.0 — 2026-11-15\n\n- fix: the week starts on Monday (#22)\n- feat: a timeline view (#21)\n"
    )
    expect(git(work, "log", "-1", "--format=%s")).toBe("release: v0.3.0")
    expect(git(work, "status", "--porcelain")).toBe("")
  })

  it("refuses with nothing to release, and off dev", () => {
    const work = widgetRepo()
    git(work, "checkout", "--quiet", "main")
    expect(() => runRelease(work, "patch")).toThrow(/runs on dev/)
    git(work, "checkout", "--quiet", "dev")
    git(work, "reset", "--quiet", "--hard", "origin/main")
    git(work, "push", "--quiet", "--force", "origin", "dev")
    expect(() => runRelease(work, "patch")).toThrow(/nothing to release/)
  })
})
