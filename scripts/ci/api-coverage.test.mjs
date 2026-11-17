import assert from "node:assert/strict"
import { test } from "node:test"

import { ALLOWED, snippetsOf, uncovered } from "./api-coverage.mjs"

test("a runtime name nothing mentions is uncovered; types and allowed names aren't checked", () => {
  const reference = {
    "grist-widget-sdk": [
      { name: "used", kind: "function" },
      { name: "unused", kind: "function" },
      { name: "SomeType", kind: "type" },
      { name: "act", kind: "re-export" },
      { name: "old", kind: "function" },
    ],
  }
  assert.deepEqual(uncovered(reference, "used()", { old: "deprecated" }), [["grist-widget-sdk", "unused"]])
})

test("a name inside another word doesn't count", () => {
  assert.deepEqual(uncovered({ e: [{ name: "fetchRows", kind: "function" }] }, "prefetchRowsX"), [["e", "fetchRows"]])
})

test("only compiled snippets count: no-check blocks and prose don't", () => {
  const mdx = "Call `a()`.\n```tsx\nb()\n```\n```tsx no-check\nc()\n```\n```ts\nd()\n```\n```bash\ne\n```\n"
  assert.deepEqual(snippetsOf(mdx).map((s) => s.trim()), ["b()", "d()"])
})

test("every allowed name says why", () => {
  for (const [name, why] of Object.entries(ALLOWED)) assert.ok(why.length > 20, name)
})
