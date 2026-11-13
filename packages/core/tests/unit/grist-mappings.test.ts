import { describe, expect, it } from "vitest"

import { validateColumnMappings, mergeWidgetColumnMaps } from "../../src/sdk/helpers/grist-mappings"

describe("validateColumnMappings", () => {
  it("puts undefined allowMultiple columns in missing only", () => {
    const result = validateColumnMappings([{ name: "Tags", allowMultiple: true }], {})
    expect(result.missing).toEqual(["Tags"])
    expect(result.emptyMultiples).toEqual([])
    expect(result.ok).toBe(false)
  })

  it("puts empty allowMultiple arrays in emptyMultiples only", () => {
    const result = validateColumnMappings([{ name: "Tags", allowMultiple: true }], { Tags: [] })
    expect(result.missing).toEqual([])
    expect(result.emptyMultiples).toEqual(["Tags"])
    expect(result.ok).toBe(false)
  })

  it("accepts mapped allowMultiple columns", () => {
    const result = validateColumnMappings([{ name: "Tags", allowMultiple: true }], { Tags: ["A"] })
    expect(result.ok).toBe(true)
  })
})

describe("mergeWidgetColumnMaps", () => {
  it("returns undefined when every source is undefined", () => {
    expect(mergeWidgetColumnMaps(undefined, undefined)).toBeUndefined()
  })

  it("merges later non-empty sources over earlier ones", () => {
    expect(
      mergeWidgetColumnMaps(
        { CountryISO: "iso2" },
        { CountryISO: "CountryISO", Count: "Count" }
      )
    ).toEqual({ CountryISO: "CountryISO", Count: "Count" })
  })

  it("treats null as an empty known payload", () => {
    expect(mergeWidgetColumnMaps(null)).toEqual({})
  })
})
