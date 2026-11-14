import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { assess, measure } from "./budget.mjs"

test("measure counts bytes and files", () => {
  const dir = mkdtempSync(join(tmpdir(), "budget-"))
  writeFileSync(join(dir, "a"), "12345")
  writeFileSync(join(dir, "b"), "1")
  assert.deepEqual(measure(dir), { bytes: 6, files: 2 })
})

test("warns from 60 % of either limit and fails past 100 %", () => {
  const limits = { bytes: 100, files: 10 }
  assert.equal(assess({ bytes: 10, files: 1 }, limits).level, "ok")
  assert.equal(assess({ bytes: 60, files: 1 }, limits).level, "warn")
  assert.equal(assess({ bytes: 10, files: 7 }, limits).level, "warn")
  assert.equal(assess({ bytes: 101, files: 1 }, limits).level, "over")
})
