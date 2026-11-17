// The SDK's chrome speaks the widget's language: the first of the person's
// languages that the widget declares and the SDK speaks.
import { screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { defineGristWidget } from "../../src/sdk"
import { chromeLocale, CHROME_MESSAGES } from "../../src/sdk/chrome-messages"
import { boundaryScreen } from "../../src/sdk/components/grist-boundary"
import { getGristSdkAlerts } from "../../src/sdk/helpers/grist-sdk-alerts"
import { initialRuntimeState } from "../../src/sdk/runtime/runtime"
import { renderWithGrist } from "../../src/emulator/testing"

describe("chromeLocale", () => {
  it("takes the person's first language the widget ships and the SDK speaks", () => {
    expect(chromeLocale(["en", "fr"], ["fr-FR", "en"])).toBe("fr")
    expect(chromeLocale(["en", "fr"], ["de", "en-GB", "fr"])).toBe("en")
    expect(chromeLocale(["en", "fr"], ["de"])).toBe("en")
  })

  it("never speaks a language the widget doesn't: an English widget keeps English chrome", () => {
    expect(chromeLocale(undefined, ["fr"])).toBe("en")
    expect(chromeLocale(["en"], ["fr"])).toBe("en")
  })

  it("falls back to the widget's first language the SDK speaks", () => {
    expect(chromeLocale(["fr", "en"], ["de"])).toBe("fr")
    expect(chromeLocale(["de"], ["de"])).toBe("en")
  })

  it("has every message in every language", () => {
    expect(Object.keys(CHROME_MESSAGES.fr).sort()).toEqual(Object.keys(CHROME_MESSAGES.en).sort())
    for (const value of Object.values(CHROME_MESSAGES.fr)) expect(value.trim()).not.toBe("")
  })
})

describe("the chrome in French", () => {
  it("names the screens, the access level as Grist's French panel does, and the alerts", () => {
    const state = { ...initialRuntimeState(), connection: "ready" as const, declaredAccess: "full" as const, grantedAccess: "read table" as const }
    const screen = boundaryScreen(state, undefined, "fr")
    expect(screen?.title).toBe("Il faut plus d'accès")
    expect(screen?.message).toContain("« Accès complet au document »")

    const ready = { ...initialRuntimeState(), connection: "ready" as const, grantedAccess: "full" as const, declaredAccess: "full" as const, mappings: {} }
    const [alert] = getGristSdkAlerts({ ...ready, readOnly: true }, {}, { locale: "fr" })
    expect(alert?.title).toBe("Document en lecture seule")
  })
})

describe("mountGristWidget's chrome follows the declaration", () => {
  afterEach(() => vi.restoreAllMocks())

  const frenchBrowser = () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-FR", "fr"])
  }

  it("speaks French for a French person when the widget ships French", async () => {
    frenchBrowser()
    const widget = defineGristWidget({ requiredAccess: "read table", languages: ["en", "fr"], columns: [{ name: "Title", type: "Text" }] })
    function Crash(): never {
      throw new Error("boom")
    }
    vi.spyOn(console, "error").mockImplementation(() => {})
    const onError = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener("error", onError)
    try {
      renderWithGrist(<Crash />, { widget, rows: [{ Title: "A" }] })
      expect(await screen.findByText("Le widget ne fonctionne plus")).toBeTruthy()
      expect(screen.getByRole("button", { name: "Recharger le widget" })).toBeTruthy()
    } finally {
      window.removeEventListener("error", onError)
    }
  })

  it("keeps English for a widget that declares no French", async () => {
    frenchBrowser()
    const widget = defineGristWidget({ requiredAccess: "read table", columns: [{ name: "Title", type: "Text" }] })
    function Crash(): never {
      throw new Error("boom")
    }
    vi.spyOn(console, "error").mockImplementation(() => {})
    const onError = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener("error", onError)
    try {
      renderWithGrist(<Crash />, { widget, rows: [{ Title: "A" }] })
      expect(await screen.findByText("The widget stopped working")).toBeTruthy()
    } finally {
      window.removeEventListener("error", onError)
    }
  })
})
