import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { loadRulesets, protectPlan, protectRefusal, runProtect } from "../src/protect.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const templateSource = path.resolve(here, "../../../templates/grist-widget-template-vite")
const rulesets = loadRulesets("/nonexistent", templateSource)

describe("the template's rulesets", () => {
  it("are main, dev and tags, as GitHub's ruleset import and API take them", () => {
    expect(rulesets.map((r) => r.name)).toEqual(["dev", "main", "tags"])
    for (const r of rulesets) {
      expect(r.enforcement).toBe("active")
      expect(r.bypass_actors).toEqual([])
      expect(r.conditions.ref_name.include.length).toBeGreaterThan(0)
    }
  })

  it("make main need a pull request and the ci.yml check, and no force push or deletion", () => {
    const main = rulesets.find((r) => r.name === "main")
    expect(main.conditions.ref_name.include).toEqual(["refs/heads/main"])
    const types = main.rules.map((r) => r.type)
    expect(types).toEqual(expect.arrayContaining(["deletion", "non_fast_forward", "pull_request", "required_status_checks"]))
    const checks = main.rules.find((r) => r.type === "required_status_checks").parameters.required_status_checks
    expect(checks).toEqual([{ context: "check" }])
    // dev → main releases are merge commits: merging must stay allowed.
    expect(main.rules.find((r) => r.type === "pull_request").parameters.allowed_merge_methods).toContain("merge")
  })

  it("keep every tag from being moved or deleted, but not from being created", () => {
    const tags = rulesets.find((r) => r.name === "tags")
    expect(tags.target).toBe("tag")
    expect(tags.conditions.ref_name.include).toEqual(["~ALL"])
    expect(tags.rules.map((r) => r.type).sort()).toEqual(["deletion", "update"])
  })
})

describe("protectPlan", () => {
  it("creates what is missing and keeps what exists under the same name", () => {
    const plan = protectPlan({ rulesets, existing: ["main"], pages: { branch: "gh-pages", path: "/" }, reporting: true })
    expect(plan.create.map((r) => r.name)).toEqual(["dev", "tags"])
    expect(plan.keep).toEqual(["main"])
    expect(plan.pages).toBe("ok")
    expect(plan.reporting).toBe("ok")
  })

  it("turns Pages and reporting on when they're off, and reports Pages served from elsewhere", () => {
    expect(protectPlan({ rulesets, existing: [], pages: null, reporting: false })).toMatchObject({ pages: "enable", reporting: "enable" })
    expect(protectPlan({ rulesets, existing: [], pages: { branch: "main", path: "/" }, reporting: true }).pages).toBe("mismatch")
  })

  it("waits for the first release", () => {
    expect(protectRefusal({ repo: "o/w", hasGhPages: true, hasRelease: true })).toBeNull()
    expect(protectRefusal({ repo: "o/w", hasGhPages: true, hasRelease: false })).toMatch(/first release/)
    expect(protectRefusal({ repo: null, hasGhPages: false, hasRelease: false })).toMatch(/GitHub repository/)
  })
})

describe("runProtect", () => {
  /** A stand-in for `gh api`: answers from `state`, records every write. */
  function fakeApi(state) {
    const writes = []
    const api = (method, apiPath, body) => {
      if (method !== "GET") {
        writes.push([method, apiPath, body?.name ?? body?.source?.branch ?? null])
        return null
      }
      if (apiPath.endsWith("/branches/gh-pages")) return state.ghPages ? { name: "gh-pages" } : null
      if (apiPath.includes("/contents/latest")) return state.released ? [{ name: "index.html" }] : null
      if (apiPath.endsWith("/rulesets")) return state.rulesets.map((name) => ({ name }))
      if (apiPath.endsWith("/pages")) return state.pages
      if (apiPath.endsWith("/private-vulnerability-reporting")) return { enabled: state.reporting }
      throw new Error(`unexpected ${apiPath}`)
    }
    return { api, writes }
  }
  const remoteUrl = "git@github.com:owner/gantt-widget.git"

  it("adds what a template copy lacks, and nothing else", () => {
    const { api, writes } = fakeApi({ ghPages: true, released: true, rulesets: ["main"], pages: { source: { branch: "gh-pages", path: "/" } }, reporting: false })
    const result = runProtect("/nonexistent", { templateDir: templateSource, api, remoteUrl })
    expect(result.repo).toBe("owner/gantt-widget")
    expect(writes).toEqual([
      ["POST", "repos/owner/gantt-widget/rulesets", "dev"],
      ["POST", "repos/owner/gantt-widget/rulesets", "tags"],
      ["PUT", "repos/owner/gantt-widget/private-vulnerability-reporting", null],
    ])
  })

  it("changes nothing in a dry run, or when everything is there", () => {
    const missing = fakeApi({ ghPages: true, released: true, rulesets: [], pages: null, reporting: false })
    runProtect("/nonexistent", { templateDir: templateSource, api: missing.api, remoteUrl, dryRun: true })
    expect(missing.writes).toEqual([])
    const complete = fakeApi({ ghPages: true, released: true, rulesets: ["dev", "main", "tags"], pages: { source: { branch: "gh-pages", path: "/" } }, reporting: true })
    expect(runProtect("/nonexistent", { templateDir: templateSource, api: complete.api, remoteUrl }).done).toEqual([])
    expect(complete.writes).toEqual([])
  })

  it("refuses before the first release", () => {
    const { api, writes } = fakeApi({ ghPages: false, released: false, rulesets: [], pages: null, reporting: false })
    expect(() => runProtect("/nonexistent", { templateDir: templateSource, api, remoteUrl })).toThrow(/first release/)
    expect(writes).toEqual([])
  })
})
