/**
 * SDK ↔ emulator integration tests.
 *
 * These tests exercise the public SDK hooks (`useGrist`) against the inline
 * emulator transport — proving that the emulator's `grist` global is a
 * faithful drop-in for the production runtime as far as our hooks are
 * concerned.
 */

import { describe, expect, it } from "vitest"
import React from "react"
import { act } from "react"
import { screen, waitFor } from "@testing-library/react"

import { useGrist } from "../../src/sdk/use-grist"
import { GristWidgetProvider } from "../../src/sdk/components/grist-widget-provider"
import { presets } from "../../src/emulator"
import { renderWithGrist } from "../../src/emulator/testing"
import { actionsOf, waitForEvent } from "../../src/emulator/testing"

function MyWidget() {
  const w = useGrist()
  if (w.status !== "ready") return <p data-testid="status">{w.status}</p>
  return (
    <div>
      <p data-testid="status">ready</p>
      <p data-testid="docName">{w.currentTableId ?? "?"}</p>
      <p data-testid="title">{w.record?.title as string | undefined}</p>
      <p data-testid="count">{w.records?.length ?? 0}</p>
      <button
        type="button"
        data-testid="add"
        onClick={() => {
          void w.table.create({ fields: { title: "New entry", done: false, priority: "low" } })
        }}
      >
        Add
      </button>
      <button
        type="button"
        data-testid="rename"
        onClick={() => {
          if (w.record) void w.table.update({ id: w.record.id as number, fields: { title: "Renamed" } })
        }}
      >
        Rename
      </button>
    </div>
  )
}

function render(opts?: Parameters<typeof renderWithGrist>[1]) {
  return renderWithGrist(
    <GristWidgetProvider options={{ requiredAccess: "full" }}>
      <MyWidget />
    </GristWidgetProvider>,
    opts
  )
}

describe("SDK + emulator (inline)", () => {
  it("widget renders the first record after ready", async () => {
    const { emulator } = render({ emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"))
    await waitFor(() => expect(screen.getByTestId("title").textContent).toBe("Buy milk"))
    expect(screen.getByTestId("count").textContent).toBe("3")
    emulator.dispose()
  })

  it("widget can create a row, observable from emulator state and bus", async () => {
    const { emulator } = render({ emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("ready"))

    const addAction = waitForEvent(
      emulator,
      (e) => e.type === "user-action" && (e.action[0] as string) === "AddRecord"
    )
    await act(async () => {
      screen.getByTestId("add").click()
    })
    await addAction

    expect(emulator.state.tables.get("Tasks")!.rows.length).toBe(4)
    const adds = actionsOf(emulator).filter((a) => a[0] === "AddRecord")
    expect(adds).toHaveLength(1)
    emulator.dispose()
  })

  it("widget receives onRecord updates after host-side mutation", async () => {
    const { emulator } = render({ emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByTestId("title").textContent).toBe("Buy milk"))
    await act(async () => {
      emulator.mutate.updateRow("Tasks", 1, { title: "Buy oat" })
    })
    await waitFor(() => expect(screen.getByTestId("title").textContent).toBe("Buy oat"))
    emulator.dispose()
  })

  it("widget receives onRecord on cursor change (cursor-driven re-render)", async () => {
    const { emulator } = render({ emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByTestId("title").textContent).toBe("Buy milk"))
    await act(async () => {
      emulator.selectRow(2)
    })
    await waitFor(() =>
      expect(screen.getByTestId("title").textContent).toBe("Write the SOTA emulator")
    )
    emulator.dispose()
  })

  it("widget can rename via TableOperations.update", async () => {
    const { emulator } = render({ emulator: { document: presets.todoList() } })
    await waitFor(() => expect(screen.getByTestId("title").textContent).toBe("Buy milk"))

    const updateAction = waitForEvent(
      emulator,
      (e) => e.type === "user-action" && (e.action[0] as string) === "UpdateRecord"
    )
    await act(async () => {
      screen.getByTestId("rename").click()
    })
    await updateAction
    await waitFor(() => expect(screen.getByTestId("title").textContent).toBe("Renamed"))
    emulator.dispose()
  })
})
