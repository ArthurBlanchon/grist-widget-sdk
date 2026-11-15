import { it, vi } from "vitest"
import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"

import * as entry from "./App"

// MapLibre needs WebGL, which jsdom lacks: the map is a double here, the real one runs in CI's real-Grist check.
vi.mock("@shared/ui/map", async () => (await import("./testing/map-double")).mapDouble)

it("renders inside Grist with every declared column mapped", () => smokeTestWidget(entry))
