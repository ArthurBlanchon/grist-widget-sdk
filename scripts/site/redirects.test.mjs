import assert from "node:assert/strict"
import { test } from "node:test"

import { REDIRECTS, redirectFiles, redirectPage, redirectTarget } from "./redirects.mjs"

test("each old path gets an index.html that sends to its target", () => {
  const files = redirectFiles("")
  assert.equal(files.length, Object.keys(REDIRECTS).length)
  const [path, html] = files.find(([p]) => p === "docs/contributing/deploy/index.html")
  assert.equal(path, "docs/contributing/deploy/index.html")
  assert.match(html, /http-equiv="refresh" content="0; url=https:\/\/github\.com\/.*site-deploy\.md"/)
  assert.match(html, /<meta name="robots" content="noindex">/)
})

test("a target inside the site takes the origin's base, a URL doesn't", () => {
  assert.equal(redirectTarget("/docs/sdk/", "/grist-widget-sdk/"), "/grist-widget-sdk/docs/sdk/")
  assert.equal(redirectTarget("/docs/sdk/", ""), "/docs/sdk/")
  assert.equal(redirectTarget("https://example.com/a", "/grist-widget-sdk/"), "https://example.com/a")
})

test("a target is escaped in the page", () => {
  assert.doesNotMatch(redirectPage('/a"><script>'), /"><script>/)
})
