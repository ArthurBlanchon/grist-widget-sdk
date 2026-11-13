/**
 * Regression: selected row must survive the window where `recordEvent` has
 * delivered (or replayed) a payload but `docApi` is still null during handshake.
 *
 * A mount-time effect that cleared selection whenever `docApi` was falsy wiped
 * the BehaviorSubject replay and left `w.mode === "empty"` in the playground
 * iframe path even though Grist had already pushed the cursor row.
 */

import "@testing-library/jest-dom/vitest"
import { describe, expect, it } from "vitest"
import React from "react"
import { render, screen, waitFor } from "@testing-library/react"

import {
  GristBoundary,
  GristWidgetProvider,
  useGrist,
} from "../../src/sdk"
import { createGristEmulator } from "../../src/emulator"
import { presets } from "../../src/emulator"
import { recordStream } from "../../src/sdk/runtime/host"
import { resetGristForTests } from "../../src/sdk/use-grist"

function fakeIframeContext(): void {
  if (typeof window === "undefined") return
  if (window.self !== window.top) return
  try {
    Object.defineProperty(window, "top", {
      configurable: true,
      get: () => ({}),
    })
  } catch {
    // jsdom may block redefinition
  }
}

function resetGristTestIsolation(): void {
  fakeIframeContext()
  resetGristForTests()
}

type Row = { id: number; title?: string }

function SelectionProbe() {
  const s = useGrist<Row>()
  return (
    <div>
      <span data-testid="mode">{s.mode}</span>
      <span data-testid="record-id">{s.record?.id ?? ""}</span>
      <span data-testid="record-title">{(s.record?.title as string) ?? ""}</span>
    </div>
  )
}

function HelloWorldProbe() {
  const w = useGrist<Row>()
  if (w.mode === "empty") return <p data-testid="view">empty</p>
  return <p data-testid="view">row:{String(w.record?.id)}</p>
}

describe("selection initial record (regression)", () => {
  it("keeps recordEvent cache replay while docApi is still null", async () => {
    resetGristTestIsolation()
    recordStream.emit({
      record: { id: 42, title: "Cached before ready" },
      mappings: null,
    })

    const emulator = createGristEmulator({ document: presets.blank() })
    try {
      render(
        <GristWidgetProvider options={{ requiredAccess: "read table" }}>
          <SelectionProbe />
        </GristWidgetProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId("record-id")).toHaveTextContent("42")
        expect(screen.getByTestId("mode")).toHaveTextContent("row")
        expect(screen.getByTestId("record-title")).toHaveTextContent("Cached before ready")
      })
    } finally {
      emulator.dispose()
    }
  })

  it("useGrist() updates record id when the host cursor changes", async () => {
    resetGristTestIsolation()

    const emulator = createGristEmulator({ document: presets.todoList() })
    try {
      render(
        <GristWidgetProvider options={{ requiredAccess: "read table" }}>
          <GristBoundary>
            <HelloWorldProbe />
          </GristBoundary>
        </GristWidgetProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId("view")).toHaveTextContent("row:1")
      })

      emulator.selectRow(2)
      await waitFor(() => {
        expect(screen.getByTestId("view")).toHaveTextContent("row:2")
      })
    } finally {
      emulator.dispose()
    }
  })

  it("hello-world shell sees the host row after handshake (useGrist)", async () => {
    resetGristTestIsolation()

    const emulator = createGristEmulator({ document: presets.todoList() })
    try {
      render(
        <GristWidgetProvider options={{ requiredAccess: "read table" }}>
          <GristBoundary>
            <HelloWorldProbe />
          </GristBoundary>
        </GristWidgetProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId("view")).toHaveTextContent("row:1")
      })
    } finally {
      emulator.dispose()
    }
  })

  it("form-edit shell sees mapped row when column mappings are configured", async () => {
    resetGristTestIsolation()

    const emulator = createGristEmulator({ document: presets.todoList() })
    emulator.setColumnMappings({
      Title: "title",
      Description: "title",
      Done: "done",
      Priority: "priority",
    })

    function FormEditProbe() {
      const w = useGrist<Row, { Title?: string }>()
      if (!w.columnMappingStatus.ok) {
        return <span data-testid="view">mapping</span>
      }
      if (w.mode === "empty") return <span data-testid="view">empty</span>
      return (
        <span data-testid="view">
          row:{String(w.record?.id)}:{String(w.mappedRecord?.Title ?? "")}
        </span>
      )
    }

    try {
      render(
        <GristWidgetProvider
          options={{
            requiredAccess: "full",
            columns: [
              { name: "Title", type: "Text" },
              { name: "Description", type: "Text", optional: true },
              { name: "Done", type: "Bool" },
              { name: "Priority", type: "Text", optional: true },
            ],
          }}
        >
          <GristBoundary gate="canRender">
            <FormEditProbe />
          </GristBoundary>
        </GristWidgetProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId("view")).toHaveTextContent("row:1:Buy milk")
      })
    } finally {
      emulator.dispose()
    }
  })
})
