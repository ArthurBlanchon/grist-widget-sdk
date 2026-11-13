import { describe, expect, it } from "vitest"

import { isGristNoiseColumn } from "../../src/sdk/helpers/grist-columns-filters"

describe("isGristNoiseColumn", () => {
  it("keeps manualSort by default", () => {
    expect(isGristNoiseColumn("manualSort")).toBe(false)
    expect(isGristNoiseColumn("manualSort", undefined, {})).toBe(false)
  })

  it("treats manualSort as noise when excludeManualSort is true", () => {
    expect(isGristNoiseColumn("manualSort", undefined, { excludeManualSort: true })).toBe(true)
  })

  it("still treats id as noise by default", () => {
    expect(isGristNoiseColumn("id")).toBe(true)
  })
})
