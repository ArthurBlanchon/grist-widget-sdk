import assert from "node:assert/strict"
import { test } from "node:test"

import { checkStatic, criteria, designViolations, listWidgets, parseFrontMatter, specColumns } from "./check-widgets.mjs"

test("front matter is key: value lines", () => {
  const { data, body } = parseFrontMatter("---\nslug: a\naccess: read table\n---\n# A\n")
  assert.deepEqual(data, { slug: "a", access: "read table" })
  assert.equal(body, "# A\n")
  assert.equal(parseFrontMatter("# none").data, null)
})

test("criteria and columns come from the spec's body", () => {
  const body = "## Columns\n\n| Column | Type |\n| --- | --- |\n| Title | Text |\n| Status | Choice |\n\n## Acceptance criteria\n\n- **AC-1** x\n- **AC-2** y\n"
  assert.deepEqual(specColumns(body), ["Title", "Status"])
  assert.deepEqual(criteria(body), ["AC-1", "AC-2"])
})

test("design rules: colours, pixels and arbitrary values, comments aside", () => {
  assert.equal(designViolations('className="text-[#fff]"').length, 2)
  assert.equal(designViolations("style={{ width: '12px' }}").length, 1)
  assert.equal(designViolations("color: rgb(0 0 0)").length, 1)
  assert.equal(designViolations('className="w-72 text-muted-foreground"').length, 0)
  assert.equal(designViolations("// #fff in a comment").length, 0)
})

test("every catalog widget passes the static checks", () => {
  const slugs = listWidgets()
  assert.ok(slugs.length > 0)
  for (const slug of slugs) assert.deepEqual(checkStatic(slug).problems, [], slug)
})
