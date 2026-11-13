/**
 * Mirrors `templates/grist-widget-template-vite` (provider + boundary + alerts + App).
 */

import "@testing-library/jest-dom/vitest"
import React from "react"
import { describe, expect, it } from "vitest"
import { act, screen, waitFor } from "@testing-library/react"

import { GristBoundary, GristWidgetProvider, useGrist } from "../../src/sdk"
import { renderWithGrist } from "../../src/emulator/testing"
import { presets } from "../../src/emulator"

function TemplateApp() {
  const w = useGrist<{ id: number; title?: string }>()
  return (
    <div>
      <span data-testid="mode">{w.mode}</span>
      <span data-testid="record-id">{String(w.record?.id ?? "")}</span>
      <span data-testid="record-title">{(w.record?.title as string) ?? ""}</span>
    </div>
  )
}

function TemplateShell() {
  return (
    <GristWidgetProvider options={{ requiredAccess: "read table" }}>
      <GristBoundary>
        <TemplateApp />
      </GristBoundary>
    </GristWidgetProvider>
  )
}

describe("template widget shell", () => {
  it("shows the selected row after handshake", async () => {
    const { emulator } = renderWithGrist(<TemplateShell />, {
      emulator: { document: presets.todoList() },
    })

    await waitFor(() => {
      expect(screen.getByTestId("mode")).toHaveTextContent("row")
      expect(screen.getByTestId("record-id")).toHaveTextContent("1")
      expect(screen.getByTestId("record-title")).toHaveTextContent("Buy milk")
    })

    act(() => emulator.selectRow(2))
    await waitFor(() => {
      expect(screen.getByTestId("record-id")).toHaveTextContent("2")
      expect(screen.getByTestId("record-title")).toHaveTextContent(
        "Write the SOTA emulator"
      )
    })
  })
})
