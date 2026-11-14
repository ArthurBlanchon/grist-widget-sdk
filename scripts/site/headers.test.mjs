import assert from "node:assert/strict"
import { test } from "node:test"

import { headerMismatches, headersFor, siteHeaders } from "./headers.mjs"

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

test("the live check compares what the file promises with what is served", () => {
  const served = new Map(headersFor(file, "/docs/"))
  assert.deepEqual(headerMismatches("/docs/", served), [])
  served.delete("content-security-policy")
  assert.deepEqual(headerMismatches("/docs/", served), [
    `/docs/: content-security-policy is absent, expected "frame-ancestors 'self'"`,
  ])
  // Cloudflare Pages adds this one to every response; the file doesn't set it for /docs/.
  const withHostDefault = new Map(headersFor(file, "/docs/"))
  withHostDefault.set("access-control-allow-origin", "*")
  assert.deepEqual(headerMismatches("/docs/", withHostDefault), [])
  const widget = new Map(headersFor(file, "/examples/x/latest/"))
  widget.set("x-frame-options", "SAMEORIGIN")
  assert.deepEqual(headerMismatches("/examples/x/latest/", widget), [
    `/examples/x/latest/: x-frame-options is "SAMEORIGIN", expected absent`,
  ])
})

test("grist-static's CORS header is still checked where the file sets it", () => {
  const served = new Map(headersFor(file, "/grist-static/0.1.6/app.html"))
  served.delete("access-control-allow-origin")
  assert.deepEqual(headerMismatches("/grist-static/0.1.6/app.html", served), [
    `/grist-static/0.1.6/app.html: access-control-allow-origin is absent, expected "*"`,
  ])
})
