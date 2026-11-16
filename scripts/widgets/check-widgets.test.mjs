import assert from "node:assert/strict"
import { test } from "node:test"

import { changelogEntries, checkChangelog, checkLicences, licenceAllowed, checkStatic, columnsSection, criteria, declarationProblems, designViolations, listWidgets, parseFrontMatter, specColumns, STANDARD_CRITERIA, namesTest, standardCriteria } from "./check-widgets.mjs"

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

test("only the Columns section's first table is columns; a second one is prose", () => {
  const body = "## Columns\n\n| Column | Type | Required | Use |\n| --- | --- | --- | --- |\n| Fields | Any, several columns | yes | the form |\n\nEach field takes its type.\n\n| Grist type | Field |\n| --- | --- |\n| Text, Any | a text box |\n\n## Access\n"
  assert.deepEqual(specColumns(body), ["Fields"])
  assert.match(columnsSection(body).prose, /Each field[\s\S]*\| Text, Any \| a text box \|/)
})

test("the declaration matches what the catalog publishes: title, description, columns both ways", () => {
  const spec = {
    data: { title: "Board", access: "full" },
    body: "## Columns\n\n| Column | Type | Required | Use |\n| --- | --- | --- | --- |\n| Title | Text | yes | x |\n| Keys | Any, several columns | no | y |\n| Notes | Text | no | z |\n",
  }
  const options = {
    requiredAccess: "full",
    columns: [{ name: "Title", type: "Text" }, { name: "Keys", optional: true, allowMultiple: true }, { name: "Notes", type: "Text", optional: true }],
  }
  const ok = { options, metadata: { title: "Board", description: "Cards." }, pkg: { description: "Cards." }, spec }
  assert.deepEqual(declarationProblems(ok), [])
  const problems = declarationProblems({
    ...ok,
    metadata: { title: "Board", description: "Other." },
    options: { requiredAccess: "full", columns: [{ name: "Title", type: "Text,Choice", optional: true }, { name: "Keys", optional: true }] },
  })
  assert.deepEqual(problems.map((p) => p.split(":")[0]), [
    "description",
    "column Title",
    "column Title",
    "column Keys",
    "column Notes",
  ])
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

  // Its placeholders are fine in a draft, never once it is listed.
  const { readFileSync } = await import("node:fs")
  const spec = join(dir, "SPEC.md")
  writeFileSync(spec, readFileSync(spec, "utf8").replace("status: draft", "status: beta"))
  const todos = checkStatic("gantt-chart", dir).problems.filter((p) => p.includes("TODO"))
  assert.deepEqual(todos.map((p) => p.split(":")[0]), ["SPEC.md", "package.json's description", "src/app/demo.ts"])

  // Its spec carries the standard criteria, and its tests AC-volume's (ADR 0018).
  assert.deepEqual(standardCriteria(readFileSync(spec, "utf8")), STANDARD_CRITERIA)
  const appTest = join(dir, "src", "app", "App.test.tsx")
  const original = readFileSync(appTest, "utf8")
  writeFileSync(appTest, original.replace('it("AC-volume', 'it.skip("AC-volume'))
  assert.ok(checkStatic("gantt-chart", dir).problems.includes('AC-volume: no test names it (it("AC-volume …"))'))
  writeFileSync(appTest, original.replace("expectVolume(<App />, widget, demo)", "Promise.resolve()"))
  assert.ok(checkStatic("gantt-chart", dir).problems.some((p) => p.startsWith("AC-volume: its test doesn't call expectVolume()")))
  writeFileSync(appTest, original)
  const withSection = readFileSync(spec, "utf8")
  writeFileSync(spec, withSection.replace(/- \*\*AC-narrow\*\*.*\n/, ""))
  assert.ok(checkStatic("gantt-chart", dir).problems.includes("SPEC.md: the Standard criteria section lacks AC-narrow"))
  // Without the section: refused.
  writeFileSync(spec, withSection.replace("## Standard criteria", "## Other notes"))
  assert.ok(checkStatic("gantt-chart", dir).problems.includes("SPEC.md: no Standard criteria section (ADR 0018; new-widget writes it)"))
  writeFileSync(spec, withSection.replace("## Standard criteria", "## Standard Criteria  "))
  assert.deepEqual(standardCriteria(readFileSync(spec, "utf8")), STANDARD_CRITERIA)
  writeFileSync(spec, withSection)
  assert.ok(namesTest('it.only("AC-3 x")', "AC-3") && !namesTest('it.todo("AC-3 x")', "AC-3") && !namesTest('it.fails("AC-3")', "AC-3"))

  // A widget may talk about to-dos: only new-widget's placeholders count.
  writeFileSync(spec, "---\nslug: gantt-chart\ntitle: T\ncategory: planning\nstatus: beta\naccess: none\n---\n## Job\n\nA TODO list, for TODO items.\n")
  assert.equal(checkStatic("gantt-chart", dir).problems.filter((p) => p.startsWith("SPEC.md: a TODO")).length, 0)
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

test("licences: permissive ones and fonts' OFL; an OR needs one, an AND needs all", () => {
  for (const ok of ["MIT", "ISC", "Apache-2.0", "(MIT OR Apache-2.0)", "(MPL-2.0 OR Apache-2.0)", "MIT AND ISC AND BSD-3-Clause", "OFL-1.1", "0BSD", "(GPL-3.0 AND MPL-2.0) OR MIT", "MIT AND (GPL-3.0 OR ISC)"]) {
    assert.ok(licenceAllowed(ok), ok)
  }
  for (const no of [
    "GPL-3.0",
    "EPL-2.0 OR GPL-3.0-or-later",
    "MPL-2.0",
    "MIT AND GPL-2.0",
    "Unknown",
    "",
    "LGPL-2.1",
    // Parentheses group: both of these require GPL.
    "(MIT OR GPL-3.0) AND GPL-2.0",
    "GPL-3.0 AND (MIT OR ISC)",
    "Apache-2.0 WITH LLVM-exception",
    "(MIT",
    "MIT OR",
  ]) {
    assert.ok(!licenceAllowed(no), no)
  }
})

test("a built widget's shipped licences are checked from dist/licenses.json", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const dir = mkdtempSync(join(tmpdir(), "lic-"))
  assert.match(checkLicences(dir)[0], /missing/)
  mkdirSync(join(dir, "dist"))
  writeFileSync(join(dir, "dist", "licenses.json"), JSON.stringify([
    { name: "react", version: "19.0.0", license: "MIT" },
    { name: "elkjs", version: "0.12.0", license: "EPL-2.0 OR GPL-3.0-or-later" },
  ]))
  assert.deepEqual(checkLicences(dir).map((p) => p.split(" is ")[0]), ["licence: elkjs@0.12.0"])
})
