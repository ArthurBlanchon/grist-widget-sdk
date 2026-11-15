import assert from "node:assert/strict"
import { test } from "node:test"

import { expectedIds, galleryProblems, pluginFiles } from "./gallery-check.mjs"

const list = [
  { widgetId: "@grist-widgets/board/v0", url: "https://gristwidgets.com/widgets/board/v0/", published: false },
  { widgetId: "@grist-widgets/board/v1", url: "https://gristwidgets.com/widgets/board/v1/", published: true },
]
const labs = { widgetId: "@gristlabs/calendar", url: "https://gristlabs.github.io/grist-widget/calendar/", published: true }

test("the plugin is the folder the docs describe", () => {
  const files = pluginFiles(list)
  assert.match(files["manifest.yml"], /^components:\n {2}widgets: widgets\.json$/m)
  assert.deepEqual(JSON.parse(files["widgets.json"]), list)
})

test("every id at its URL, Grist Labs' widgets kept: no problem", () => {
  assert.deepEqual(galleryProblems(list, [labs, ...list.map((w) => ({ ...w, source: { pluginId: "grist-widgets" } }))]), [])
})

test("a missing id, a moved URL, a published flag lost, or Grist Labs' list replaced, each says so", () => {
  const served = [{ ...list[1], url: "https://elsewhere.example/board/" }]
  assert.deepEqual(galleryProblems(list, served), [
    "@grist-widgets/board/v0: not in Grist's list",
    "@grist-widgets/board/v1: Grist has https://elsewhere.example/board/, the list https://gristwidgets.com/widgets/board/v1/",
    "Grist Labs' own widgets aren't listed: Grist couldn't read their list, or the plugin's took its place",
  ])
  assert.match(galleryProblems(list, [labs, list[0], { ...list[1], published: false }])[0], /published is false/)
})

test("an id the repository's catalog expects but the site's list lacks fails", () => {
  const problems = galleryProblems(list, [labs, ...list], ["@grist-widgets/board/v1", "@grist-widgets/new/v0"])
  assert.deepEqual(problems, ["@grist-widgets/new/v0: the repository's catalog has it, the site's list doesn't"])
})

test("the expected ids are the catalog's widgets on their declared major", () => {
  const ids = expectedIds()
  assert.ok(ids.length > 0 && ids.every((id) => /^@grist-widgets\/[a-z0-9-]+\/v\d+$/.test(id)))
})
