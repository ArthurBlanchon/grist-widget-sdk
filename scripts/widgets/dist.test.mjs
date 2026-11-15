import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import { compareVersions, declaredVersions, latestVersion, majorChannels, releasedVersions, unreleased } from "./dist.mjs"

test("versions compare as numbers, not text", () => {
  assert.equal(compareVersions("0.10.0", "0.9.9"), 1)
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0)
  assert.equal(latestVersion(["0.2.0", "0.10.1", "0.9.0"]), "0.10.1")
  assert.equal(latestVersion([]), null)
  assert.throws(() => compareVersions("1.0", "1.0.0"))
})

test("released versions are the directories with an index.html", () => {
  const dist = mkdtempSync(join(tmpdir(), "dist-"))
  for (const v of ["0.1.0", "0.2.0"]) {
    mkdirSync(join(dist, "kanban-board", v), { recursive: true })
    writeFileSync(join(dist, "kanban-board", v, "index.html"), "")
  }
  mkdirSync(join(dist, "kanban-board", "0.3.0"))
  assert.deepEqual(releasedVersions(dist), { "kanban-board": ["0.1.0", "0.2.0"] })
  assert.deepEqual(releasedVersions(join(dist, "missing")), {})
})

test("unreleased lists the declared versions missing from the release branch", () => {
  assert.deepEqual(unreleased({ a: "0.2.0", b: "0.1.0" }, { a: ["0.1.0"], b: ["0.1.0"] }), [{ slug: "a", version: "0.2.0" }])
})

test("every catalog widget declares an x.y.z version", () => {
  const versions = declaredVersions(new URL("../../widgets", import.meta.url).pathname)
  assert.ok(Object.keys(versions).length > 0)
})

test("each major's channel is its newest version, so a new major never reaches it", () => {
  assert.deepEqual(majorChannels(["0.1.0", "0.2.1", "1.0.0", "0.10.0", "1.2.0", "2.0.0"]), { v0: "0.10.0", v1: "1.2.0", v2: "2.0.0" })
  assert.deepEqual(majorChannels(["0.1.0"]), { v0: "0.1.0" })
  assert.deepEqual(majorChannels([]), {})
})
