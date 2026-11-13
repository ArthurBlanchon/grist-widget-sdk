import { describe, expect, it } from "vitest"

import {
  normalizeGristChoiceListEntries,
  parseGristWidgetOptionsCell,
} from "../../src/sdk/helpers/grist-widget-options"

describe("parseGristWidgetOptionsCell", () => {
  it("parses JSON string", () => {
    expect(parseGristWidgetOptionsCell('{"choices":["A","B"]}')).toEqual({ choices: ["A", "B"] })
  })

  it("accepts object", () => {
    expect(parseGristWidgetOptionsCell({ choices: ["x"] })).toEqual({ choices: ["x"] })
  })

  it("returns undefined for invalid", () => {
    expect(parseGristWidgetOptionsCell("not json")).toBeUndefined()
    expect(parseGristWidgetOptionsCell(null)).toBeUndefined()
  })
})

describe("normalizeGristChoiceListEntries", () => {
  it("maps strings and choiceOptions colors", () => {
    const wo = {
      choices: ["Low", "High"],
      choiceOptions: {
        High: { fillColor: "#ff0000", textColor: "#ffffff" },
      },
    }
    expect(normalizeGristChoiceListEntries(wo)).toEqual([
      { value: "Low", label: "Low", fillColor: undefined, textColor: undefined },
      { value: "High", label: "High", fillColor: "#ff0000", textColor: "#ffffff" },
    ])
  })

  it("returns empty when missing choices", () => {
    expect(normalizeGristChoiceListEntries({})).toEqual([])
    expect(normalizeGristChoiceListEntries(undefined)).toEqual([])
  })
})
