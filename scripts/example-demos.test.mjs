import assert from "node:assert/strict"
import { test } from "node:test"

import { demoHash, staleDemos } from "./example-demos.mjs"

const w = { id: "a", title: "A", requiredAccess: "read table", columns: [{ name: "X", type: "Text" }] }

test("current demos pass", () => {
  assert.deepEqual(staleDemos([w], { a: demoHash(w) }, () => true), [])
})

test("a missing, stale or orphaned demo is reported", () => {
  assert.match(staleDemos([w], { a: demoHash(w) }, () => false)[0], /no examples\/_demos\/a.grist/)
  const changed = { ...w, columns: [{ name: "Y", type: "Text" }] }
  assert.match(staleDemos([changed], { a: demoHash(w) }, () => true)[0], /different columns/)
  assert.match(staleDemos([], { a: "x" }, () => true)[0], /no such example/)
})
