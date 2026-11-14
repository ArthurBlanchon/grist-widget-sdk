// `create-grist-widget protect` (`pnpm exec create-grist-widget protect` in a
// widget, once its first release is live): the repository settings a widget
// repository needs and that "Use this template" doesn't copy, applied with
// the owner's own `gh` CLI:
//
// - the rulesets in .github/rulesets/ (main: pull request and the `check`
//   status, no force push or deletion; dev: no force push or deletion; every
//   tag: no update or deletion), created when the repository has none of
//   that name;
// - private vulnerability reporting, turned on;
// - GitHub Pages served from the gh-pages branch, checked (a template copy
//   with all branches gets it on its own; a fresh repository doesn't).
//
// It only adds what is missing and says what it did; `--dry-run` says what it
// would do. A ruleset that exists under the same name is left as it is.

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { githubRepoUrl } from "./release.mjs"

export const RULESETS_DIR = ".github/rulesets"

/** The rulesets to apply: the widget's own .github/rulesets/*.json, else the template's. */
export function loadRulesets(cwd, templateDir) {
  const dir = [path.join(cwd, RULESETS_DIR), path.join(templateDir, RULESETS_DIR)].find((d) => existsSync(d))
  if (!dir) throw new Error(`no ${RULESETS_DIR}/ in the widget or the template`)
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")))
}

/**
 * What to do, from what the repository has: `{ create, keep, pages, reporting }`.
 * `existing` is the names of its rulesets; `pages` GitHub's Pages source
 * (`{ branch, path }`) or null when Pages is off; `reporting` whether private
 * vulnerability reporting is on.
 */
export function protectPlan({ rulesets, existing, pages, reporting }) {
  const names = new Set(existing)
  return {
    create: rulesets.filter((r) => !names.has(r.name)),
    keep: rulesets.filter((r) => names.has(r.name)).map((r) => r.name),
    pages: !pages ? "enable" : pages.branch === "gh-pages" && pages.path === "/" ? "ok" : "mismatch",
    reporting: reporting ? "ok" : "enable",
  }
}

/** Why `protect` won't run yet, or null: before the first release, the reset would be blocked. */
export function protectRefusal({ repo, hasGhPages, hasRelease }) {
  if (!repo) return "origin isn't a GitHub repository: protect needs github.com/<owner>/<repo>."
  if (!hasGhPages || !hasRelease)
    return "the widget has no release yet: run protect after its first release (the first one commits to main and resets dev, which the rulesets would block)."
  return null
}

/** `gh api` as a function: (method, path, body?) → parsed JSON, or null for an empty or 404 reply. */
export function ghApi(method, apiPath, body) {
  const args = ["api", "--method", method, apiPath, "-H", "Accept: application/vnd.github+json"]
  if (body !== undefined) args.push("--input", "-")
  try {
    const out = execFileSync("gh", args, {
      input: body === undefined ? undefined : JSON.stringify(body),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return out.trim() ? JSON.parse(out) : null
  } catch (err) {
    const stderr = String(err.stderr ?? "")
    if (/HTTP 404/.test(stderr)) return null
    if (err.code === "ENOENT") {
      throw new Error("the GitHub CLI (gh) isn't installed: https://cli.github.com, then `gh auth login`.", { cause: err })
    }
    throw new Error(`gh api ${method} ${apiPath}: ${stderr.trim() || err.message}`, { cause: err })
  }
}

/**
 * Applies the plan to `cwd`'s GitHub repository. `api` is ghApi (a stub in
 * tests). Returns `{ repo, plan, done }`, `done` listing what changed.
 */
export function runProtect(cwd, { templateDir, dryRun = false, api = ghApi, remoteUrl } = {}) {
  const remote =
    remoteUrl ??
    (() => {
      try {
        return execFileSync("git", ["remote", "get-url", "origin"], { cwd, encoding: "utf8" }).trim()
      } catch {
        return null
      }
    })()
  const repoUrl = githubRepoUrl(remote)
  const repo = repoUrl ? repoUrl.replace("https://github.com/", "") : null
  const hasGhPages = repo ? api("GET", `repos/${repo}/branches/gh-pages`) !== null : false
  const hasRelease = repo ? api("GET", `repos/${repo}/contents/latest?ref=gh-pages`) !== null : false
  const refusal = protectRefusal({ repo, hasGhPages, hasRelease })
  if (refusal) throw new Error(refusal)

  const rulesets = loadRulesets(cwd, templateDir)
  const existing = (api("GET", `repos/${repo}/rulesets`) ?? []).map((r) => r.name)
  const pagesInfo = api("GET", `repos/${repo}/pages`)
  const reporting = api("GET", `repos/${repo}/private-vulnerability-reporting`)?.enabled === true
  const plan = protectPlan({ rulesets, existing, pages: pagesInfo?.source ?? null, reporting })

  const done = []
  if (dryRun) return { repo, plan, done }
  for (const ruleset of plan.create) {
    api("POST", `repos/${repo}/rulesets`, ruleset)
    done.push(`ruleset "${ruleset.name}" created`)
  }
  if (plan.reporting === "enable") {
    api("PUT", `repos/${repo}/private-vulnerability-reporting`)
    done.push("private vulnerability reporting turned on")
  }
  if (plan.pages === "enable") {
    api("POST", `repos/${repo}/pages`, { source: { branch: "gh-pages", path: "/" } })
    done.push("GitHub Pages turned on, from gh-pages")
  }
  return { repo, plan, done }
}
