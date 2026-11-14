// `create-grist-widget release <patch|minor|major>` (`pnpm release` in a
// widget): the release commit on `dev`, before the `dev` → `main` pull
// request whose merge publishes. It bumps package.json's version (merging
// without a bump publishes nothing: the deploy skips a version already
// live), writes the CHANGELOG.md entry from what `dev` has that `main`
// doesn't, and commits. Pushing and opening the pull request stay with the
// person or agent running it: the command prints both.

import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export const BUMPS = ["patch", "minor", "major"]

/** `1.2.3` bumped by `patch`, `minor` or `major`; a pre-release suffix is dropped. */
export function nextVersion(current, bump) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(current ?? "")
  if (!m) throw new Error(`package.json's version "${current}" is not x.y.z`)
  const [major, minor, patch] = m.slice(1).map(Number)
  if (bump === "major") return `${major + 1}.0.0`
  if (bump === "minor") return `${major}.${minor + 1}.0`
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`
  throw new Error(`release takes patch, minor or major, not "${bump}"`)
}

/** The commit subjects worth a changelog line: not merges, not earlier release commits. */
export function changelogLines(subjects) {
  return subjects
    .map((s) => s.trim())
    .filter((s) => s && !/^Merge (pull request|branch|remote-tracking branch) /.test(s) && !/^(chore: )?release[: ]/i.test(s))
}

/** The CHANGELOG.md entry for `version`. */
export function changelogEntry({ version, date, lines }) {
  return `## ${version} — ${date}\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`
}

/** `changelog` (CHANGELOG.md's text, or "" when missing) with `entry` as its newest entry. */
export function withEntry(changelog, entry, title) {
  const text = changelog.trim() ? changelog : `# ${title}\n`
  const lines = text.split("\n")
  const heading = lines.findIndex((l) => /^# /.test(l))
  if (heading === -1) return `${entry}\n${text}`
  const before = lines.slice(0, heading + 1).join("\n")
  const after = lines.slice(heading + 1).join("\n").replace(/^\n+/, "")
  return `${before}\n\n${entry}${after ? `\n${after}` : ""}`
}

/** `https://github.com/owner/repo` from a remote URL (https or ssh), or null. */
export function githubRepoUrl(remote) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(remote ?? "")
  return m ? `https://github.com/${m[1]}/${m[2]}` : null
}

/** Why `release` won't run here, or null: `{ branch, dirty, ahead, behind, hasMain }`. */
export function releaseRefusal({ branch, dirty, ahead, behind, hasMain }) {
  if (branch !== "dev") return `release runs on dev (this is ${branch}): it prepares the dev → main pull request.`
  if (dirty) return "the working tree has uncommitted changes: commit or stash them first."
  if (!hasMain) return "origin/main doesn't exist yet: the widget's first release is the first merge of dev into main."
  if (behind > 0) return `dev is ${behind} commit(s) behind origin/dev: pull first.`
  if (ahead > 0) return `dev has ${ahead} commit(s) not on origin/dev: push them first, so the release commit is the only new one.`
  return null
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
}

/**
 * Prepares the release commit in `cwd`: `{ version, lines, compareUrl }`, or
 * throws with the reason it can't.
 */
export function runRelease(cwd, bump, { today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!BUMPS.includes(bump)) throw new Error(`Usage: pnpm release <${BUMPS.join("|")}>`)
  git(cwd, ["fetch", "--quiet", "origin"])
  const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
  const dirty = git(cwd, ["status", "--porcelain"]) !== ""
  const hasRef = (ref) => {
    try {
      git(cwd, ["rev-parse", "--verify", "--quiet", ref])
      return true
    } catch {
      return false
    }
  }
  const hasMain = hasRef("origin/main")
  const [behind, ahead] = hasRef("origin/dev")
    ? git(cwd, ["rev-list", "--left-right", "--count", "origin/dev...HEAD"]).split(/\s+/).map(Number)
    : [0, 0]
  const refusal = releaseRefusal({ branch, dirty, ahead, behind, hasMain })
  if (refusal) throw new Error(refusal)

  const subjects = git(cwd, ["log", "--first-parent", "--format=%s", "origin/main..HEAD"]).split("\n")
  const lines = changelogLines(subjects)
  if (lines.length === 0) throw new Error("dev has nothing main doesn't: there is nothing to release.")

  const pkgPath = path.join(cwd, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  const version = nextVersion(pkg.version, bump)
  pkg.version = version
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n")

  const changelogPath = path.join(cwd, "CHANGELOG.md")
  const changelog = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : ""
  writeFileSync(changelogPath, withEntry(changelog, changelogEntry({ version, date: today, lines }), pkg.name ?? "Changelog"))

  git(cwd, ["add", "package.json", "CHANGELOG.md"])
  git(cwd, ["commit", "--quiet", "-m", `release: v${version}`])

  let remote = null
  try {
    remote = git(cwd, ["remote", "get-url", "origin"])
  } catch {
    // no origin: no link to print
  }
  const repo = githubRepoUrl(remote)
  return { version, lines, compareUrl: repo ? `${repo}/compare/main...dev?expand=1` : null }
}
