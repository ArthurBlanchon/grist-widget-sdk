import { describe, expect, it } from "vitest"

import { defineMessages, detectLocale, format } from "./i18n"

describe("detectLocale", () => {
  it("takes the first of French or English the browser prefers", () => {
    expect(detectLocale(["fr-FR", "en"])).toBe("fr")
    expect(detectLocale(["de", "en-GB", "fr"])).toBe("en")
    expect(detectLocale(["de"])).toBe("en")
    expect(detectLocale([])).toBe("en")
  })
})

describe("format", () => {
  it("fills placeholders and leaves unknown ones", () => {
    expect(format("{n} cards in {col}", { n: 3, col: "Done" })).toBe("3 cards in Done")
    expect(format("{missing}", { n: 1 })).toBe("{missing}")
  })
})

describe("defineMessages", () => {
  it("keeps both dictionaries", () => {
    const m = defineMessages({ en: { a: "A" }, fr: { a: "À" } })
    expect(m.fr.a).toBe("À")
  })

  it("refuses a French dictionary without every English key", () => {
    // @ts-expect-error: "b" is missing from fr
    defineMessages({ en: { a: "A", b: "B" }, fr: { a: "À" } })
  })
})
