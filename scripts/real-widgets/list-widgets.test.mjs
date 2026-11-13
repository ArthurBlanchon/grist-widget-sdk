// node --test "scripts/real-widgets/*.test.mjs": the widget list the
// "Real widgets" workflow checks (list-widgets.mjs).

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { referenceRepos, widgetList } from "./list-widgets.mjs"

const entry = (repoUrl, extra = {}) => ({ name: "W", repoUrl, widgetUrl: `${repoUrl}/`, description: "d", ...extra })

test("only entries marked reference: true are checked", () => {
  const registry = [
    entry("https://github.com/gristlabs/custom-charts-widget"),
    entry("https://github.com/acme/map", { reference: true }),
    entry("https://github.com/acme/other", { reference: "true" }),
  ]
  assert.deepEqual(referenceRepos(registry), ["acme/map"])
})

test("pending widgets are added, duplicates dropped", () => {
  const registry = [entry("https://github.com/Acme/map/", { reference: true })]
  assert.deepEqual(widgetList(registry, ["acme/MAP", "acme/gantt"]), ["Acme/map", "acme/gantt"])
})

test("names that could reach a shell are refused", () => {
  assert.throws(() => referenceRepos([entry('https://github.com/acme/x";rm', { reference: true })]), /unexpected repoUrl/)
  assert.throws(() => referenceRepos([entry("https://github.com/acme/x/tree/dev", { reference: true })]), /unexpected repoUrl/)
  assert.throws(() => referenceRepos([entry("https://github.com/acme/..", { reference: true })]), /unexpected repoUrl/)
  assert.throws(() => widgetList([], ["acme/x $(id)"]), /pending\.json/)
})

test("an empty list fails rather than checking nothing", () => {
  assert.throws(() => widgetList([entry("https://github.com/acme/map")], []), /no widget to check/)
  assert.throws(() => widgetList({}, ["acme/map"]), /not an array/)
})

test("pending.json holds valid repository names", () => {
  const pending = JSON.parse(readFileSync(new URL("./pending.json", import.meta.url), "utf8"))
  assert.ok(Array.isArray(pending))
  if (pending.length) assert.deepEqual(widgetList([], pending), pending)
})
