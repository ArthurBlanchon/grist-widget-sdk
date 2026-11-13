/**
 * When Grist reports a lower `interaction.access_level` than the widget
 * declared in `grist.ready`, the handshake must deny authz and
 * `<GristBoundary>` must not render children.
 */

import "@testing-library/jest-dom/vitest"
import React from "react"
import { describe, expect, it } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"

import { renderWithGrist } from "../../src/emulator/testing/render-with-grist"
import { GristBoundary } from "../../src/sdk/components/grist-boundary"
import { GristWidgetProvider } from "../../src/sdk/components/grist-widget-provider"

function WidgetShell() {
  return (
    <GristWidgetProvider options={{ requiredAccess: "read table" }}>
      <GristBoundary>
        <span data-testid="widget-body">Hello</span>
      </GristBoundary>
    </GristWidgetProvider>
  )
}

describe("access level from onOptions", () => {
  it("blocks the widget when the host grants less than requiredAccess", async () => {
    const { emulator } = renderWithGrist(<WidgetShell />)
    await waitFor(() =>
      expect(screen.getByTestId("widget-body")).toBeInTheDocument()
    )

    emulator.setInteraction({ access_level: "none" })

    await waitFor(() =>
      expect(screen.queryByTestId("widget-body")).not.toBeInTheDocument()
    )
    expect(screen.getByText(/Custom widget settings|Access level/i)).toBeInTheDocument()
  })

  it("reload does not show the widget while access is still insufficient", async () => {
    const { emulator } = renderWithGrist(<WidgetShell />)
    await waitFor(() =>
      expect(screen.getByTestId("widget-body")).toBeInTheDocument()
    )

    emulator.setInteraction({ access_level: "none" })

    await waitFor(() =>
      expect(screen.queryByTestId("widget-body")).not.toBeInTheDocument()
    )

    await act(async () => {
      screen.getByRole("button", { name: /try again/i }).click()
    })

    await waitFor(() =>
      expect(screen.queryByTestId("widget-body")).not.toBeInTheDocument()
    )
    await waitFor(() =>
      expect(screen.getByText(/Custom widget settings|Access level/i)).toBeInTheDocument()
    )
  })
})
