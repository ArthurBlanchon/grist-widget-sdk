/**
 * Grist may reuse the same `onRecord` payload object and mutate it in place.
 * The selection hook must shallow-copy so React re-renders.
 */

import { describe, expect, it } from "vitest"
import React from "react"
import { act, screen, waitFor } from "@testing-library/react"

import { GristWidgetProvider, useGrist } from "../../src/sdk"
import { recordStream } from "../../src/sdk/runtime/host"
import { renderWithGrist } from "../../src/emulator/testing"
import { presets } from "../../src/emulator"

function Probe() {
  const s = useGrist<{ id: number; title?: string }>()
  return (
    <span data-testid="record-id">
      {s.record?.id ?? ""}:{(s.record?.title as string) ?? ""}
    </span>
  )
}

describe("selection record copy", () => {
  it("updates when onRecord reuses the same object reference with a new id", async () => {
    renderWithGrist(
      <GristWidgetProvider options={{ requiredAccess: "read table" }}>
        <Probe />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    await waitFor(() =>
      expect(screen.getByTestId("record-id")).toHaveTextContent("1:Buy milk")
    )

    const shared: Record<string, unknown> = { id: 1, title: "Buy milk" }

    act(() => {
      shared.id = 2
      shared.title = "Write the SOTA emulator"
      recordStream.emit({ record: shared, mappings: null })
    })

    await waitFor(() =>
      expect(screen.getByTestId("record-id")).toHaveTextContent(
        "2:Write the SOTA emulator"
      )
    )
  })
})
