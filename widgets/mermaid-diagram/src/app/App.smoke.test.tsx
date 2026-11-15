import { it, vi } from "vitest"
import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"

import * as entry from "./App"

// Mermaid needs the browser's text metrics, which jsdom lacks; CI's real-Grist check draws real diagrams.
vi.mock("mermaid", () => ({ default: { initialize() {}, async parse() {}, async render() { return { svg: "<svg xmlns='http://www.w3.org/2000/svg'/>" } } } }))

it("renders inside Grist with every declared column mapped", () => smokeTestWidget(entry))
