import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { jsGzipBytes } from "./size-budget.mjs"

test("counts every .js file under the directory, gzipped, and nothing else", () => {
  const dir = mkdtempSync(join(tmpdir(), "size-"))
  mkdirSync(join(dir, "assets"))
  writeFileSync(join(dir, "assets", "a.js"), "x".repeat(10_000))
  writeFileSync(join(dir, "assets", "b.css"), "y".repeat(10_000))
  const one = jsGzipBytes(dir)
  assert.ok(one > 0 && one < 200)
  writeFileSync(join(dir, "c.js"), "z".repeat(10_000))
  assert.ok(jsGzipBytes(dir) > one)
})
