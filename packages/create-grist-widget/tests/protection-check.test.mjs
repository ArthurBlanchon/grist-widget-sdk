import { describe, expect, it } from "vitest"

import { checkProtection, ISSUE_TITLE, protectionIssueBody } from "../src/protection-check.mjs"

/** A stand-in for fetch: answers from `state`, records every call. */
function fakeFetch(state) {
  const calls = []
  const fetchImpl = async (url, init) => {
    const path = url.replace("https://api.github.com/repos/owner/widget", "")
    calls.push([init.method, path, init.headers.authorization])
    const reply = (status, body) => ({ ok: status < 300, status, json: async () => body })
    if (state.fail) return reply(403, { message: "Forbidden" })
    if (init.method === "GET" && path === "/rulesets") return reply(200, state.rulesets.map((name) => ({ name })))
    if (init.method === "GET" && path.startsWith("/issues")) return reply(200, state.issues)
    if (init.method === "POST" && path === "/issues") return reply(201, { html_url: "https://github.com/owner/widget/issues/7" })
    return reply(404, {})
  }
  return { fetchImpl, calls }
}
const base = { ownerRepo: "owner/widget", token: "t0k" }

describe("checkProtection", () => {
  it("is quiet when main, dev and tags have their rulesets", async () => {
    const { fetchImpl, calls } = fakeFetch({ rulesets: ["main", "dev", "tags", "other"], issues: [] })
    expect(await checkProtection({ ...base, firstRelease: true, fetchImpl })).toEqual({ missing: [], issue: null, note: null })
    expect(calls.map((c) => c.slice(0, 2))).toEqual([["GET", "/rulesets"]])
    expect(calls[0][2]).toBe("Bearer t0k")
  })

  it("names what is missing on a later release, without opening an issue", async () => {
    const { fetchImpl, calls } = fakeFetch({ rulesets: ["main"], issues: [] })
    expect(await checkProtection({ ...base, fetchImpl })).toEqual({ missing: ["dev", "tags"], issue: null, note: null })
    expect(calls).toHaveLength(1)
  })

  it("opens one issue on the first release, and not a second one", async () => {
    const fresh = fakeFetch({ rulesets: [], issues: [] })
    const res = await checkProtection({ ...base, firstRelease: true, fetchImpl: fresh.fetchImpl })
    expect(res).toEqual({ missing: ["main", "dev", "tags"], issue: "https://github.com/owner/widget/issues/7", note: null })
    expect(fresh.calls.map((c) => c.slice(0, 2)).at(-1)).toEqual(["POST", "/issues"])

    const again = fakeFetch({ rulesets: [], issues: [{ title: ISSUE_TITLE }] })
    expect((await checkProtection({ ...base, firstRelease: true, fetchImpl: again.fetchImpl })).issue).toBeNull()
    expect(again.calls.some((c) => c[0] === "POST")).toBe(false)
  })

  it("never fails the deploy: an API error becomes a note", async () => {
    const { fetchImpl } = fakeFetch({ fail: true })
    const res = await checkProtection({ ...base, firstRelease: true, fetchImpl })
    expect(res.missing).toBeNull()
    expect(res.note).toMatch(/protection check skipped: GET \/rulesets: HTTP 403/)
  })

  it("asks for the protect command in the issue, naming what is missing", () => {
    const body = protectionIssueBody(["main", "tags"])
    expect(body).toContain("pnpm exec create-grist-widget protect --dry-run")
    expect(body).toContain("`main`, `tags`")
  })
})
