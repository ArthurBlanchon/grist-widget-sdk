import assert from "node:assert/strict"
import { test } from "node:test"

import { siteHeaders } from "./headers.mjs"

/** Cloudflare's semantics: every matching rule applies in order; `! Name` removes. */
function headersFor(file, url) {
  const rules = []
  for (const line of file.split("\n")) {
    if (!line.trim()) continue
    if (!line.startsWith(" ")) rules.push({ path: line.trim(), lines: [] })
    else rules.at(-1).lines.push(line.trim())
  }
  const matches = (path) => {
    const re = new RegExp(`^${path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`)
    return re.test(url)
  }
  const out = new Map()
  for (const rule of rules.filter((r) => matches(r.path))) {
    for (const line of rule.lines) {
      if (line.startsWith("! ")) out.delete(line.slice(2).toLowerCase())
      else {
        const i = line.indexOf(":")
        out.set(line.slice(0, i).toLowerCase(), line.slice(i + 1).trim())
      }
    }
  }
  return out
}

const file = siteHeaders()

test("the docs can only be framed by the site itself", () => {
  for (const url of ["/", "/docs/sdk/api/use-grist/", "/widgets/"]) {
    const h = headersFor(file, url)
    assert.equal(h.get("content-security-policy"), "frame-ancestors 'self'", url)
    assert.equal(h.get("x-frame-options"), "SAMEORIGIN", url)
    assert.match(h.get("permissions-policy"), /camera=\(\)/, url)
  }
})

test("widgets and the template preview stay embeddable by any Grist", () => {
  for (const url of ["/examples/kanban/latest/", "/examples/kanban/demo/", "/template-preview/"]) {
    const h = headersFor(file, url)
    assert.equal(h.has("content-security-policy"), false, url)
    assert.equal(h.has("x-frame-options"), false, url)
    assert.equal(h.has("permissions-policy"), false, url)
  }
})

test("grist-static stays readable cross-origin", () => {
  const h = headersFor(file, "/grist-static/0.1.6/app.bundle.js")
  assert.equal(h.get("access-control-allow-origin"), "*")
  assert.equal(h.has("x-frame-options"), false)
})

test("every response gets the common hardening", () => {
  for (const url of ["/", "/examples/kanban/latest/", "/grist-static/0.1.6/x.js"]) {
    const h = headersFor(file, url)
    assert.equal(h.get("x-content-type-options"), "nosniff", url)
    assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin", url)
    assert.match(h.get("strict-transport-security"), /^max-age=\d+/, url)
  }
})
