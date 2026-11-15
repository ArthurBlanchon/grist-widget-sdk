import assert from "node:assert/strict"
import { test } from "node:test"

import { BASE, parseCspExtra, specCsp, widgetCsp } from "../../widgets/_shared/csp.mjs"
import { listWidgets, parseFrontMatter, WIDGETS_DIR } from "./check-widgets.mjs"

const directives = (policy) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]))

test("the base runs only the widget's own scripts and Grist's plugin API", () => {
  const p = directives(widgetCsp())
  // The plugin API file itself, not its host, which serves much else.
  assert.deepEqual(p["script-src"], ["'self'", "https://docs.getgrist.com/grist-plugin-api.js"])
  assert.deepEqual(p["object-src"], ["'none'"])
  assert.deepEqual(p["connect-src"], ["'self'"])
  assert.ok(!widgetCsp().includes("unsafe-eval"))
})

test("a spec adds sources; grist is any http(s) origin; object-src replaces 'none'", () => {
  const { extra, problems } = parseCspExtra("connect-src grist https://*.basemaps.cartocdn.com; object-src blob:")
  assert.deepEqual(problems, [])
  const p = directives(widgetCsp(extra))
  assert.deepEqual(p["connect-src"], ["'self'", "https:", "http:", "https://*.basemaps.cartocdn.com"])
  assert.deepEqual(p["object-src"], ["blob:"])
  assert.deepEqual(directives(widgetCsp())["connect-src"], BASE["connect-src"])
})

test("scripts, eval and other schemes can't be added", () => {
  for (const bad of ["script-src https://x.example", "default-src *", "connect-src 'unsafe-eval'", "connect-src javascript:", "img-src *", "connect-src http://x.example", "img-src", "connect-src https:", "connect-src http:"]) {
    assert.ok(parseCspExtra(bad).problems.length > 0, bad)
  }
})

test("every catalog widget's csp front matter parses", async () => {
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  for (const slug of listWidgets()) {
    const { data } = parseFrontMatter(readFileSync(join(WIDGETS_DIR, slug, "SPEC.md"), "utf8"))
    assert.deepEqual(parseCspExtra(data.csp).problems, [], slug)
  }
})

test("connect-src takes named hosts or grist, never a bare scheme; other directives may", () => {
  assert.match(parseCspExtra("connect-src https:").problems[0], /send data anywhere/)
  assert.deepEqual(parseCspExtra("img-src https:; style-src https:").problems, [])
})

test("the build and the check read csp: the same way", () => {
  assert.equal(specCsp("---\nslug: a\ncsp: connect-src grist\naccess: full\n---\n# A\n"), "connect-src grist")
  // An empty value is empty, not the next line's key.
  assert.equal(specCsp("---\ncsp:\naccess: full\n---\n"), "")
  assert.equal(specCsp("# no front matter"), "")
})
