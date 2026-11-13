import { describe, expect, it } from "vitest"

import {
  normalizeWidgetInteraction,
  parseGristWidgetLinkingInfo,
} from "../../src/sdk/helpers/grist-widget-interaction"

describe("parseGristWidgetLinkingInfo", () => {
  it("reads asTarget null from Grist linking payload", () => {
    expect(
      parseGristWidgetLinkingInfo({ asTarget: null, asSource: false })
    )?.toEqual({ asTarget: null, asSource: false })
  })
})

describe("normalizeWidgetInteraction", () => {
  it("maps accessLevel and linking from Grist InteractionOptions", () => {
    expect(
      normalizeWidgetInteraction({
        accessLevel: "read table",
        linking: { asTarget: null, asSource: true },
      })
    ).toMatchObject({
      access_level: "read table",
      linking: { asTarget: null, asSource: true },
    })
  })
})
