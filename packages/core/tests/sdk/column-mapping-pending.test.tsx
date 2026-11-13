/**
 * Column mapping should stay pending until Grist reports mappings, so widgets
 * are not blocked on load with a false "incomplete mapping" alert.
 */

import { describe, expect, it } from "vitest"
import React from "react"
import { screen, waitFor } from "@testing-library/react"

import { GristWidgetProvider, useGrist } from "../../src/sdk"
import { useGristSdkAlerts } from "../../src/sdk/helpers/grist-sdk-alerts"
import { renderWithGrist } from "../../src/emulator/testing"
import { presets } from "../../src/emulator"

function MappingProbe() {
  const w = useGrist()
  const alerts = useGristSdkAlerts()
  return (
    <div>
      <span data-testid="status">{w.status}</span>
      <span data-testid="mapping-ok">{String(w.columnMappingStatus.ok)}</span>
      <span data-testid="mapping-pending">{String(w.columnMappingStatus.pending ?? false)}</span>
      <span data-testid="alert-count">{alerts.length}</span>
    </div>
  )
}

describe("columnMappingStatus pending on load", () => {
  it("does not emit mapping alerts when mappings are configured", async () => {
    const { emulator } = renderWithGrist(
      <GristWidgetProvider
        options={{
          requiredAccess: "read table",
          columns: [{ name: "CountryISO" }, { name: "Count" }],
        }}
      >
        <MappingProbe />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    emulator.setColumnMappings({ CountryISO: "title", Count: "done" })

    // Note: `pendingColumnMappingStatus` already has `ok: true` (so the host
    // can't claim a missing mapping while the stream hasn't been bound). We
    // therefore wait on the *fully* settled state (`pending: false` AND
    // `ok: true`) in a single `waitFor` to avoid asserting on the transient
    // pending-but-ok window.
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("ready")
      expect(screen.getByTestId("mapping-pending")).toHaveTextContent("false")
      expect(screen.getByTestId("mapping-ok")).toHaveTextContent("true")
      expect(screen.getByTestId("alert-count")).toHaveTextContent("0")
    })
  })
})
