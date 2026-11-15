import { it } from "vitest"
import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"

import * as entry from "./App"

it("renders inside Grist with every declared column mapped", () => smokeTestWidget(entry))
