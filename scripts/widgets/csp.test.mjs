import assert from "node:assert/strict"
import { test } from "node:test"

import { BASE, parseCspExtra, specCsp, widgetCsp } from "../../widgets/_shared/csp.mjs"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { checkPluginApi, PLUGIN_API_DIR, PLUGIN_API_FILE, PLUGIN_API_GRIST_STATIC, pinnedPluginApi } from "../../widgets/_shared/plugin-api.mjs"
import { GRIST_STATIC_INTEGRITY, gristStaticPackage } from "../site/grist-static.mjs"
import { listWidgets, parseFrontMatter, WIDGETS_DIR } from "./check-widgets.mjs"

const directives = (policy) => Object.fromEntries(policy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]))

test("the base runs only the widget's own scripts", () => {
  const p = directives(widgetCsp())
  // No outside script, Grist's plugin API included: the build ships its own copy (_shared/plugin-api.mjs).
  assert.deepEqual(p["script-src"], ["'self'"])
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

test("the shipped plugin API is pinned: the committed file matches its sha512", () => {
  assert.equal(PLUGIN_API_FILE, `grist-plugin-api-${PLUGIN_API_GRIST_STATIC}.js`)
  assert.equal(pinnedPluginApi().license, "Apache-2.0")
  assert.match(checkPluginApi(Buffer.from("grist = {}"))[0], /not the pinned file/)
})

// The committed copy and licence are grist-static's, from its npm tarball
// (integrity-checked). Needs the registry: always run in CI, skipped offline elsewhere.
test("the committed plugin API and licence are grist-static's own", async (t) => {
  assert.ok(GRIST_STATIC_INTEGRITY[PLUGIN_API_GRIST_STATIC], `grist-static ${PLUGIN_API_GRIST_STATIC} has no pinned integrity`)
  let pkg
  try {
    pkg = await gristStaticPackage(PLUGIN_API_GRIST_STATIC)
  } catch (error) {
    if (process.env.CI || !/fetch failed|ENOTFOUND|EAI_AGAIN|answered/.test(String(error?.message ?? error))) throw error
    t.skip(`registry unreachable: ${error.message}`)
    return
  }
  assert.ok(readFileSync(join(pkg, "dist", "grist-plugin-api.js")).equals(readFileSync(join(PLUGIN_API_DIR, PLUGIN_API_FILE))))
  assert.equal(readFileSync(join(pkg, "LICENSE.txt"), "utf8"), readFileSync(join(PLUGIN_API_DIR, "LICENSE.txt"), "utf8"))
  assert.equal(JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).license, "Apache-2.0")
})
