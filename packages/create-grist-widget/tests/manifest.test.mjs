import { describe, expect, it } from "vitest"

import { buildManifest, MANIFEST_SCHEMA } from "../src/manifest.mjs"

const base = {
  pkg: { name: "world-map", version: "0.2.0", license: "MIT", description: "pkg description" },
  options: { requiredAccess: "read table", columns: [{ name: "CountryISO", type: "Text" }, "Count"] },
  metadata: { title: "World map", description: "Choropleth of country counts." },
  ownerRepo: "ArthurBlanchon/world-map",
  base: "/world-map/v0.2.0/",
  sdkVersion: "0.3.27",
  cliVersion: "0.3.32",
  now: new Date("2026-11-07T12:00:00Z"),
}

describe("buildManifest", () => {
  it("is a Grist custom widget entry (ICustomWidget), plus the SDK's own key", () => {
    expect(buildManifest(base)).toEqual({
      name: "World map",
      widgetId: "@arthurblanchon/world-map",
      url: "https://arthurblanchon.github.io/world-map/v0.2.0/",
      published: true,
      accessLevel: "read table",
      columns: [{ name: "CountryISO", type: "Text" }, "Count"],
      renderAfterReady: false,
      description: "Choropleth of country counts.",
      authors: [{ name: "ArthurBlanchon", url: "https://github.com/ArthurBlanchon" }],
      lastUpdatedAt: "2026-11-07T12:00:00.000Z",
      gristWidgetSdk: {
        schema: MANIFEST_SCHEMA,
        channel: "release",
        version: "0.2.0",
        repository: "https://github.com/ArthurBlanchon/world-map",
        license: "MIT",
        sdk: "0.3.27",
        createGristWidget: "0.3.32",
      },
    })
  })

  it("points at the widget's demo page when it has one", () => {
    expect(buildManifest({ ...base, hasDemo: true }).gristWidgetSdk.demo).toBe(
      "https://arthurblanchon.github.io/world-map/v0.2.0/demo/"
    )
    expect(buildManifest(base).gristWidgetSdk).not.toHaveProperty("demo")
  })

  it("keeps a dev build out of Grist's picker", () => {
    const m = buildManifest({ ...base, base: "/world-map/dev/" })
    expect(m.published).toBe(false)
    expect(m.gristWidgetSdk.channel).toBe("dev")
    expect(m.url).toBe("https://arthurblanchon.github.io/world-map/dev/")
  })

  it("falls back to package.json, and to no access, without metadata or columns", () => {
    const m = buildManifest({ ...base, metadata: undefined, options: {} })
    expect(m.name).toBe("world-map")
    expect(m.description).toBe("pkg description")
    expect(m.accessLevel).toBe("none")
    expect(m).not.toHaveProperty("columns")
  })

  it("refuses what it can't publish correctly", () => {
    expect(() => buildManifest({ ...base, ownerRepo: "nope" })).toThrow(/owner\/repo/)
    expect(() => buildManifest({ ...base, base: "world-map/v1/" })).toThrow(/--base/)
    expect(() => buildManifest({ ...base, options: { requiredAccess: "admin" } })).toThrow(/requiredAccess/)
  })
})
