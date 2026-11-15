import assert from "node:assert/strict"
import { test } from "node:test"

import { changelogEntries, checkChangelog, checkStatic, criteria, designViolations, listWidgets, parseFrontMatter, specColumns } from "./check-widgets.mjs"

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

test("a generated widget passes the static checks it can before its code is written", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { dirname, join } = await import("node:path")
  const { widgetFiles, SLUG } = await import("./new-widget.mjs")
  assert.ok(SLUG.test("gantt-chart") && !SLUG.test("Gantt") && !SLUG.test("-x"))
  const dir = join(mkdtempSync(join(tmpdir(), "w-")), "gantt-chart")
  for (const [rel, content] of Object.entries(widgetFiles({ slug: "gantt-chart" }))) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), content)
  }
  assert.deepEqual(checkStatic("gantt-chart", dir).problems, [])
})

test("a widget's changelog: an entry per version, newest first, the declared one on top", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const text = "# Changelog\n\n## 0.2.0 (2026-11-20)\n\n- New option.\n\n## 0.1.0 (2026-11-14)\n\nFirst release.\n"
  assert.deepEqual(changelogEntries(text), [["0.2.0", "- New option."], ["0.1.0", "First release."]])
  const dir = mkdtempSync(join(tmpdir(), "c-"))
  assert.match(checkChangelog(dir, "0.1.0")[0], /CHANGELOG.md is missing/)
  writeFileSync(join(dir, "CHANGELOG.md"), text)
  assert.deepEqual(checkChangelog(dir, "0.2.0"), [])
  assert.match(checkChangelog(dir, "0.3.0")[0], /first entry is 0.2.0, not 0.3.0/)
  writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n\n## 0.3.0\n\n## 0.2.0\n\n- x\n")
  assert.match(checkChangelog(dir, "0.3.0")[0], /says nothing/)
  writeFileSync(join(dir, "CHANGELOG.md"), "# Changelog\n\n## 0.3.0\n\n<!-- todo -->\n\n## 0.2.0\n\n- x\n")
  assert.match(checkChangelog(dir, "0.3.0")[0], /says nothing/)
  assert.deepEqual(changelogEntries("## 0.4.0"), [["0.4.0", ""]])
  assert.deepEqual(changelogEntries("## 0.2.0\n\n```md\n## 9.9.9\n```\n- y\n").map(([v]) => v), ["0.2.0"])
})
