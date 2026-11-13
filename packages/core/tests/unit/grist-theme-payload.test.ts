import { describe, expect, it } from "vitest"

import { parseGristThemePayload } from "../../src/sdk/helpers/grist-theme-payload"

describe("parseGristThemePayload", () => {
  it("reads flat theme payloads", () => {
    expect(parseGristThemePayload({ theme: "dark" })).toBe("dark")
  })

  it("reads production Grist theme objects (appearance)", () => {
    expect(
      parseGristThemePayload({
        theme: { appearance: "dark", name: "dark", colors: {} },
      })
    ).toBe("dark")
  })
})
