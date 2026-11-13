import { describe, expect, it } from "vitest"

import { createGristEmulator, presets } from "../../src/emulator"
import { waitForEvent } from "../../src/emulator/testing"

describe("waitForEvent", () => {
  it("waits for the next matching event, not one already in history", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    emu.theme.set("light")

    const pending = waitForEvent(emu, "theme", { timeoutMs: 500 })
    emu.theme.set("dark")

    const event = await pending
    expect(event.type).toBe("theme-change")
    expect(event.message).toMatchObject({
      theme: { appearance: "dark", name: "dark", colors: {} },
    })
    emu.dispose()
  })

  it("rejects with a useful message on timeout", async () => {
    const emu = createGristEmulator({ document: presets.blank() })

    await expect(waitForEvent(emu, "ready", { timeoutMs: 50 })).rejects.toThrow(
      /waitForEvent timed out after 50ms \(kind: ready\)/
    )
    emu.dispose()
  })

  it("supports custom predicates for bus events", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const pending = waitForEvent(
      emu,
      (e) => e.type === "user-action" && Array.isArray(e.action) && e.action[0] === "AddRecord"
    )
    emu.mutate.addRow("Tasks", { title: "Late", done: false })
    const event = await pending
    expect(event.type).toBe("user-action")
    emu.dispose()
  })

  it("resolves on ready", async () => {
    const emu = createGristEmulator({ document: presets.blank() })
    const pending = waitForEvent(emu, "ready")
    await emu.grist!.ready({ requiredAccess: "read table" })
    expect((await pending).type).toBe("ready")
    emu.dispose()
  })

  it("resolves on records (data-change)", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    await emu.grist!.ready({ requiredAccess: "read table" })
    const pending = waitForEvent(emu, "records")
    emu.mutate.addRow("Tasks", { title: "Another", done: false, priority: "low" })
    expect((await pending).type).toBe("data-change")
    emu.dispose()
  })

  it("resolves on record (cursor-change)", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    await emu.grist!.ready({ requiredAccess: "read table" })
    const pending = waitForEvent(emu, "record")
    emu.selectRow(2)
    const event = await pending
    expect(event).toMatchObject({ type: "cursor-change", rowId: 2 })
    emu.dispose()
  })

  it("resolves on cursor (cursor-change)", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    await emu.grist!.ready({ requiredAccess: "read table" })
    const pending = waitForEvent(emu, "cursor")
    emu.selectRow(3)
    expect((await pending).type).toBe("cursor-change")
    emu.dispose()
  })

  it("resolves on options", async () => {
    const emu = createGristEmulator({
      document: presets.todoList(),
      widgetOptions: { theme: "light" },
    })
    await emu.grist!.ready({ requiredAccess: "read table" })
    const pending = waitForEvent(emu, "options")
    await emu.setOptions({ theme: "dark", autoRefresh: true })
    expect((await pending).type).toBe("options-change")
    emu.dispose()
  })

  it("resolves on theme", async () => {
    const emu = createGristEmulator({ document: presets.blank() })
    const pending = waitForEvent(emu, "theme")
    emu.theme.set("dark")
    expect((await pending).type).toBe("theme-change")
    emu.dispose()
  })
})
