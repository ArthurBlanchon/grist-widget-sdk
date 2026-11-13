import { describe, expect, it } from "vitest"

import { addedAgeExceptions, ageExceptions } from "../src/age-exceptions.mjs"

// The template's own pnpm-workspace.yaml, before any install.
const TEMPLATE = `# pnpm 11 reads build-script approvals from here (not from package.json).
allowBuilds:
  esbuild: true
`

// What pnpm 11.1 wrote into a real widget repo (gantt-widget) after a
// loose-mode install of a version under 24 h old.
const AFTER_INSTALL = `${TEMPLATE}minimumReleaseAgeExclude:
  - grist-widget-sdk@0.2.15
  - grist-widget-sdk@0.3.20
`

describe("ageExceptions", () => {
  it("returns nothing when the key is absent", () => {
    expect(ageExceptions(TEMPLATE)).toEqual([])
  })

  it("reads block-style entries, as pnpm writes them", () => {
    expect(ageExceptions(AFTER_INSTALL)).toEqual([
      "grist-widget-sdk@0.2.15",
      "grist-widget-sdk@0.3.20",
    ])
  })

  it("reads flow-style and quoted entries", () => {
    expect(ageExceptions(`minimumReleaseAgeExclude: ["a@1.0.0", b@2.0.0]\n`)).toEqual([
      "a@1.0.0",
      "b@2.0.0",
    ])
    expect(ageExceptions(`minimumReleaseAgeExclude:\n  - "a@1.0.0" # why\n`)).toEqual(["a@1.0.0"])
  })

  it("stops at the next top-level key, skipping blank lines and comments in between", () => {
    const yaml = `minimumReleaseAgeExclude:
  - a@1.0.0

  # a comment
  - b@2.0.0
allowBuilds:
  - not-an-exception
`
    expect(ageExceptions(yaml)).toEqual(["a@1.0.0", "b@2.0.0"])
  })

  it("handles an empty key and CRLF line endings", () => {
    expect(ageExceptions("minimumReleaseAgeExclude:\n")).toEqual([])
    expect(ageExceptions("minimumReleaseAgeExclude:\r\n  - a@1.0.0\r\n")).toEqual(["a@1.0.0"])
  })
})

describe("addedAgeExceptions", () => {
  it("lists only the entries the install added", () => {
    expect(addedAgeExceptions(TEMPLATE, AFTER_INSTALL)).toEqual([
      "grist-widget-sdk@0.2.15",
      "grist-widget-sdk@0.3.20",
    ])
    const before = `${TEMPLATE}minimumReleaseAgeExclude:\n  - grist-widget-sdk@0.2.15\n`
    expect(addedAgeExceptions(before, AFTER_INSTALL)).toEqual(["grist-widget-sdk@0.3.20"])
  })

  it("is empty when the install added none, or when there was no file", () => {
    expect(addedAgeExceptions(TEMPLATE, TEMPLATE)).toEqual([])
    expect(addedAgeExceptions("", "")).toEqual([])
  })
})
