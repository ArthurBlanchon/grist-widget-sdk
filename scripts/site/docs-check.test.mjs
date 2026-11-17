import assert from "node:assert/strict"
import { test } from "node:test"

import { ALLOWED_PAGES, DOCS_DIR, listPages, oldForms, proseWords, referenceOldForms } from "./docs-check.mjs"

test("the old forms are found, with their line", () => {
  const text = "# Page\n\nexport const GRIST_OPTIONS = {}\nconst w = useGrist<Row>()\nrenderWithGrist(<App />)\nrenderWithGrist(<App />, { widget, rows })\nfetchTable(\"T\")"
  assert.deepEqual(oldForms(text).map(([line]) => line), [3, 4, 5, 7])
})

test("the current API, and Grist's own plugin API, are no old form", () => {
  assert.deepEqual(oldForms("const w = widget.useGrist()\nrenderWithGrist(<App />, { widget, rows })\nawait w.fetchRows()"), [])
  assert.deepEqual(oldForms("await grist.docApi.fetchTable(\"T\")\nawait grist.fetchSelectedTable()"), [])
})

test("a renderWithGrist without its widget is found, over several lines or with > in props", () => {
  const text = "a\nrenderWithGrist(\n  <App />\n)\nrenderWithGrist(<App onSave={() => 1} />)\nrenderWithGrist(<App />, { emulator })\nrenderWithGrist(\n  <App />,\n  { widget, rows },\n)"
  assert.deepEqual(oldForms(text).map(([line]) => line), [2, 5, 6])
})

test("words count the prose, not the front matter, code or tags", () => {
  const text = "---\ntitle: A\ndescription: b c d\n---\nimport X from 'y'\n\nOne two three.\n\n```ts\nconst a = 1 + 2\n```\n\n<Callout type=\"warn\">Four five</Callout>\n"
  assert.equal(proseWords(text), 5)
})

test("every page is listed, and the navigation lists every page", async () => {
  const { readFileSync } = await import("node:fs")
  const { relative } = await import("node:path")
  const { DOCS_DIR } = await import("./docs-check.mjs")
  const pages = listPages().map((p) => relative(DOCS_DIR, p).replace(/\.mdx$/, ""))
  assert.ok(pages.length > 0)
  const nav = JSON.parse(readFileSync(new URL("../../apps/www/content/docs/meta.json", import.meta.url), "utf8")).pages.filter((p) => !p.startsWith("---"))
  assert.deepEqual([...nav].sort(), [...pages].sort())
})

test("its own signature and GristWidgetApp are no bare render", () => {
  assert.deepEqual(oldForms("### `renderWithGrist(ui, options?)`\nrenderWithGrist(<GristWidgetApp App={W} options={o} />)"), [])
})

test("a render of a variable named ui without its widget is still bare", () => {
  assert.equal(oldForms("renderWithGrist(ui)").length, 1)
  assert.equal(oldForms("renderWithGrist(ui, { emulator })").length, 1)
})

test("a page can't allow old forms itself: only ALLOWED_PAGES, each with a reason, on a real page", () => {
  assert.equal(oldForms("{/* docs-check: old forms allowed, it documents the renames */}\nexport const GRIST_OPTIONS = {}").length, 1)
  const pages = listPages().map((p) => p.slice(DOCS_DIR.length))
  for (const [page, why] of Object.entries(ALLOWED_PAGES)) {
    assert.ok(pages.includes(page), page)
    assert.ok(why.length > 20, page)
  }
})

test("the generated reference's summaries get the check too", () => {
  const reference = { "grist-widget-sdk/app": [{ name: "A", summary: "Export GRIST_OPTIONS." }, { name: "B", summary: "Fine." }] }
  assert.deepEqual(referenceOldForms(reference).map(([name]) => name), ["grist-widget-sdk/app A"])
})
