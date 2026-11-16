import { afterEach, beforeAll, it, vi } from "vitest"
import { cleanup, installJsdomStubs } from "grist-widget-sdk/emulator/testing"
import { expectVolume, VOLUME_TIMEOUT_MS } from "@shared/testing"

import App, { widget } from "./App"
import { demo } from "./demo"

// MapLibre draws the points on a canvas: the double does too, so the count is the widget's own DOM.
vi.mock("@shared/ui/map", async () => (await import("./testing/map-double")).drawnMapDouble)
vi.mock("./world-country-layer", async () => (await import("./testing/map-double")).countryLayerDouble)

beforeAll(installJsdomStubs)
afterEach(() => cleanup())

it("AC-volume renders 5,000 rows within the DOM budget", () => expectVolume(<App />, widget, demo), VOLUME_TIMEOUT_MS)
