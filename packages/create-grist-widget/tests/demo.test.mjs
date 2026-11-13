import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { DEMO_GRIST_PORT, demoArgs, demoRefusal, localPluginApi } from "../src/demo.mjs"
import { GRIST_IMAGE, openUrl } from "../src/grist-local.mjs"

function dirWith(pkg) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "demo-test-"))
  if (pkg) writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg))
  return dir
}

describe("demo", () => {
  it("takes Grist's port, and nothing else", () => {
    expect(demoArgs([])).toEqual({ gristPort: DEMO_GRIST_PORT, save: false })
    expect(demoArgs(["--port", "9090"])).toEqual({ gristPort: 9090, save: false })
    expect(demoArgs(["--", "--port", "9090"])).toEqual({ gristPort: 9090, save: false })
    expect(demoArgs(["--save"])).toEqual({ gristPort: DEMO_GRIST_PORT, save: true })
    expect(() => demoArgs(["--port", "x"])).toThrow(/port number/)
    expect(() => demoArgs(["--open"])).toThrow(/unknown argument/)
  })

  it("runs only in a grist-widget-sdk widget, with Docker up", () => {
    const up = () => true
    expect(demoRefusal(dirWith(null), { docker: up })).toMatch(/where package.json is/)
    expect(demoRefusal(dirWith({ name: "x" }), { docker: up })).toMatch(/not a grist-widget-sdk widget/)
    const widget = dirWith({ name: "w", dependencies: { "grist-widget-sdk": "^0.3.27" } })
    expect(demoRefusal(widget, { docker: () => false })).toMatch(/Docker isn't running/)
    expect(demoRefusal(widget, { docker: up })).toBeNull()
  })

  it("serves the widget the local Grist's plugin API", () => {
    const html = '<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>'
    expect(localPluginApi("http://localhost:8484").transformIndexHtml(html)).toBe(
      '<script src="http://localhost:8484/grist-plugin-api.js"></script>'
    )
  })

  it("opens the widget's page, signed in as the default user", () => {
    expect(openUrl("http://localhost:8484", "abc", 2)).toBe("http://localhost:8484/login?next=%2Fdoc%2Fabc%2Fp%2F2")
  })

  it("runs a pinned Grist", () => {
    if (!process.env.GRIST_IMAGE) expect(GRIST_IMAGE).toMatch(/^gristlabs\/grist:\d+\.\d+\.\d+$/)
  })
})
