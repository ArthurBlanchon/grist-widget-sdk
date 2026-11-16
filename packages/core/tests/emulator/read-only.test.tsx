import { afterEach, describe, expect, it } from "vitest"
import React from "react"
import { cleanup } from "@testing-library/react"

import { createGristEmulator, presets } from "../../src/emulator"
import { renderWithGrist } from "../../src/emulator/testing"
import { isReadOnlyUrl } from "../../src/sdk/runtime/runtime"

const readonlyInUrl = () => new URLSearchParams(location.search).getAll("readonly")

afterEach(() => {
  cleanup()
  history.replaceState(null, "", "/")
})

describe("a document open read-only, in the emulator", () => {
  it("refuses every table write as Grist does, selectedTable and getTable included", async () => {
    const emu = createGristEmulator({ document: presets.todoList(), readOnly: true })
    const g = emu.grist!
    await expect(g.selectedTable.update({ id: 1, fields: { title: "x" } })).rejects.toThrow("No write access")
    await expect(g.getTable("Tasks").create({ fields: { title: "x" } })).rejects.toThrow("No write access")
    await expect(g.selectedTable.destroy(1)).rejects.toThrow("No write access")
    expect(emu.state.tables.get("Tasks")!.rows.map((r) => r.title)).toEqual(["Buy milk", "Write the SOTA emulator", "Ship it"])
    emu.dispose()
    expect(readonlyInUrl()).toEqual([])
  })

  it("renderWithGrist leaves the caller's options as they were", () => {
    const shared = { document: presets.todoList() }
    renderWithGrist(<span />, { emulator: shared, readOnly: true })
    expect(shared).not.toHaveProperty("readOnly")
  })

  it("takes readonly=true back out of the URL when Testing Library cleans up", () => {
    renderWithGrist(<span />, { emulator: { document: presets.todoList() }, readOnly: true })
    expect(readonlyInUrl()).toEqual(["true"])
    cleanup()
    expect(readonlyInUrl()).toEqual([])
  })

  it("keeps an existing read-only emulator read-only, and refuses readOnly for an editable one", () => {
    const emu = createGristEmulator({ document: presets.todoList(), readOnly: true })
    renderWithGrist(<span />, { existing: emu })
    expect(readonlyInUrl()).toEqual(["true"])
    cleanup()
    emu.dispose()
    const editable = createGristEmulator({ document: presets.todoList() })
    expect(() => renderWithGrist(<span />, { existing: editable, readOnly: true })).toThrow(/createGristEmulator\(\{ readOnly: true \}\)/)
    editable.dispose()
  })

  it("reads Grist's value, the last one, over one the widget's own URL carries", () => {
    history.replaceState(null, "", "/?readonly=false&access=full&readonly=true")
    expect(isReadOnlyUrl()).toBe(true)
    history.replaceState(null, "", "/?readonly=true&readonly=false")
    expect(isReadOnlyUrl()).toBe(false)
  })
})
