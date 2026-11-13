import { describe, expect, it } from "vitest"
import React from "react"
import { screen, waitFor } from "@testing-library/react"

import { GristBoundary, GristWidgetProvider, useGristContext } from "../../src/sdk"
import { renderWithGrist } from "../../src/emulator/testing"

function Probe() {
  const w = useGristContext()
  return (
    <div>
      <span data-testid="status">{w.status}</span>
      <span data-testid="mode">{w.mode}</span>
    </div>
  )
}

describe("SDK React integration", () => {
  it("boots through provider + boundary and reaches ready", async () => {
    renderWithGrist(
      <GristWidgetProvider options={{ requiredAccess: "read table" }}>
        <GristBoundary>
          <Probe />
        </GristBoundary>
      </GristWidgetProvider>
    )

    // Wait for the fully-settled state: status = ready, AND the cached record
    // from the default `presets.blank()` (which contains one row) has been
    // delivered through the GristEvent singleton, so mode = "row". Asserting
    // the post-event-delivery state avoids racing against the legacy/manager
    // microtask ordering of "phase=online" vs "subscription replay".
    await waitFor(
      () => {
        expect(screen.getByTestId("status")).toHaveTextContent("ready")
        expect(screen.getByTestId("mode")).toHaveTextContent("row")
      },
      { timeout: 5000 }
    )
  })
})
