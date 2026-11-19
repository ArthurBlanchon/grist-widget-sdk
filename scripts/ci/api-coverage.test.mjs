import assert from "node:assert/strict"
import { test } from "node:test"

import { ALLOWED, snippetsOf, staleAllowed, stripComments, uncovered, usesOf } from "./api-coverage.mjs"

const reference = {
  "grist-widget-sdk": [
    { name: "used", kind: "function" },
    { name: "unused", kind: "function" },
    { name: "SomeType", kind: "type" },
    { name: "old", kind: "function" },
    { name: "ns", kind: "namespace" },
  ],
  "grist-widget-sdk/emulator/testing": [{ name: "act", kind: "re-export" }, { name: "presets", kind: "const" }],
  "grist-widget-sdk/emulator": [{ name: "presets", kind: "const" }],
}

test("a runtime name no file imports from its entry is uncovered; types, re-exports and allowed names aren't checked", () => {
  const uses = usesOf(['import { used, type SomeType } from "grist-widget-sdk"', 'import { presets } from "grist-widget-sdk/emulator"'])
  assert.deepEqual(uncovered(reference, uses, { old: "deprecated" }), [
    ["grist-widget-sdk", "unused"],
    ["grist-widget-sdk", "ns"],
    ["grist-widget-sdk/emulator/testing", "presets"],
  ])
})

test("a mention in a comment, a string or a local name doesn't count; an alias or a namespace import does", () => {
  const sources = [
    '// import { unused } from "grist-widget-sdk"\nconst s = "unused"\nfunction unused() {}',
    '/* import { old } from "grist-widget-sdk" */',
    'import { used as u } from "grist-widget-sdk"',
    'import * as sdk from "grist-widget-sdk"\nsdk.ns()',
    'const url = "https://example.com" // a URL in a string keeps the line\nimport {\n  presets,\n} from "grist-widget-sdk/emulator"',
  ]
  const uses = usesOf(sources)
  assert.deepEqual([...uses.get("grist-widget-sdk")].sort(), ["ns", "used"])
  assert.deepEqual([...uses.get("grist-widget-sdk/emulator")], ["presets"])
  assert.match(stripComments('a // b\nc /* d */ e "http://x"'), /^a \nc   e "http:\/\/x"$/)
})

test("only compiled snippets count: no-check, ts, indented and titled blocks, and prose don't", () => {
  const mdx = [
    "Call `a()`.",
    "```tsx", "b()", "```",
    "```tsx no-check", "c()", "```",
    "```ts", "d()", "```",
    "  ```tsx", "  e()", "  ```",
    '```tsx title="a b"', "f()", "```",
  ].join("\n")
  const snippets = snippetsOf(mdx)
  assert.equal(snippets.length, 1)
  assert.match(snippets[0], /b\(\)/)
})

test("a snippet counts with the imports the docs harness supplies", () => {
  const [file] = snippetsOf("```tsx\nconst w = useGrist()\n```\n")
  assert.ok(usesOf([file]).get("grist-widget-sdk")?.has("useGrist"))
})

test("an allowed name that is no longer exported, or is now used, is stale", () => {
  const uses = usesOf(['import { used } from "grist-widget-sdk"'])
  assert.deepEqual(staleAllowed(reference, uses, { old: "why", used: "why", gone: "why", SomeType: "why" }), ["used", "gone", "SomeType"])
})

test("every allowed name says why", () => {
  for (const [name, why] of Object.entries(ALLOWED)) assert.ok(why.length > 20, name)
})
