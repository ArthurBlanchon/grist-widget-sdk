/**
 * Smoke test: the widget renders inside an emulated Grist, mounted as
 * `main.tsx` mounts it, with every column its declaration lists mapped.
 *
 * It only reads the declaration, so it stays valid as the widget changes,
 * and it improves with each SDK release. `.github/workflows/ci.yml` runs it
 * on every pull request, Dependabot's `grist-widget-sdk` updates included:
 * an SDK release that breaks this widget turns that PR red before the merge.
 *
 * It is the widget's own file: a widget using a browser API jsdom lacks
 * (WebGL, say) stubs it here, with `vi.mock`. Widget-specific assertions go
 * in their own tests (see `App.test.tsx`).
 */
import { it } from "vitest"
import { smokeTestWidget } from "grist-widget-sdk/emulator/testing"

import * as entry from "./App"

it("renders inside Grist with every declared column mapped", () =>
  smokeTestWidget(entry))
