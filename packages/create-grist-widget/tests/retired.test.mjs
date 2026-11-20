// The commands 0.8 retired (ADR 0023): each exits 1, before writing
// anything, with a pointer to the catalog.
import { spawnSync } from "node:child_process"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const BIN = path.resolve(import.meta.dirname, "../bin/create-grist-widget.mjs")
const dirs = []
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

function run(...args) {
  const cwd = mkdtempSync(path.join(tmpdir(), "cgw-retired-"))
  dirs.push(cwd)
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8", env: { ...process.env, CI: "1" } })
  return { ...r, cwd }
}

describe("retired commands", () => {
  for (const args of [["list"], ["use", "form-edit"], ["create", "foo", "--example", "form-edit"], ["create", "foo", "--example=form-edit"], ["init", "--example", "x"]]) {
    it(`${args.join(" ")} exits 1 with the catalog, and writes nothing`, () => {
      const r = run(...args)
      expect(r.status).toBe(1)
      expect(r.stderr).toContain("was retired in create-grist-widget 0.8")
      expect(r.stderr).toContain("https://gristwidgets.com/widgets/")
      expect(readdirSync(r.cwd)).toEqual([])
    })
  }

  it("says how to name a widget list or use", () => {
    expect(run("list").stderr).toContain("create-grist-widget create list")
    expect(run("use").stderr).toContain("create-grist-widget create use")
  })

  it("leaves --example blank to the template", () => {
    const r = run("create", "foo", "--example", "blank", "--yes", "--no-install")
    // Scaffolding itself needs the built template, which CI's cli job doesn't
    // build: the smoke test covers it. Here, only that it isn't refused.
    expect(r.stderr).not.toContain("was retired")
  }, 30_000)
})
