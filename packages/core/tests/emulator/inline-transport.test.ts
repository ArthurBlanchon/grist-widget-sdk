import { describe, expect, it, vi } from "vitest"

import { createGristEmulator, presets } from "../../src/emulator"

describe("inline transport", () => {
  it("synthesises grist global with all expected methods", () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    expect(emu.grist).toBeDefined()
    const g = emu.grist!
    expect(typeof g.ready).toBe("function")
    expect(typeof g.onRecord).toBe("function")
    expect(typeof g.onRecords).toBe("function")
    expect(typeof g.onOptions).toBe("function")
    expect(typeof g.fetchSelectedTable).toBe("function")
    expect(typeof g.fetchSelectedRecord).toBe("function")
    expect(g.docApi).toBeDefined()
    expect(g.selectedTable).toBeDefined()
    emu.dispose()
  })

  it("ready() triggers initial onRecords / onRecord / onOptions", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const onRecord = vi.fn()
    const onRecords = vi.fn()
    const onOptions = vi.fn()
    g.onRecord(onRecord)
    g.onRecords(onRecords)
    g.onOptions(onOptions)

    await g.ready({ requiredAccess: "read table" })
    await flush()

    expect(onOptions).toHaveBeenCalled()
    expect(onRecords).toHaveBeenCalled()
    expect(onRecord).toHaveBeenCalled()
    expect(onRecord.mock.calls[0][0]).toMatchObject({ id: 1 })

    emu.dispose()
  })

  it("selectedTable.create routes through applyUserActions", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const result = await g.selectedTable.create({ fields: { title: "New", done: false, priority: "low" } })
    expect(result).toMatchObject({ id: 4 })
    expect(emu.state.tables.get("Tasks")!.rows.length).toBe(4)
    emu.dispose()
  })

  it("selectedTable.update mutates and emits onRecord", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const onRecord = vi.fn()
    g.onRecord(onRecord)
    await g.ready()
    await flush()

    onRecord.mockClear()
    await g.selectedTable.update({ id: 1, fields: { title: "Buy oat" } })
    await flush()

    expect(onRecord).toHaveBeenCalled()
    const last = onRecord.mock.calls.at(-1)![0]
    expect(last).toMatchObject({ id: 1, title: "Buy oat" })
    emu.dispose()
  })

  it("setOptions emits onOptions with the merged value", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const cb = vi.fn()
    g.onOptions(cb)
    await g.setOptions({ theme: "dark" })
    await flush()
    expect(cb).toHaveBeenCalled()
    expect(cb.mock.calls.at(-1)![0]).toEqual({ theme: "dark" })
  })

  it("docApi.fetchTable returns columnar data", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const data = await emu.grist!.docApi.fetchTable("Tasks")
    expect(data.id).toEqual([1, 2, 3])
    expect(data.title).toEqual(["Buy milk", "Write the SOTA emulator", "Ship it"])
    emu.dispose()
  })

  it("fetchSelectedTable transposes to rows when format=rows (parity with production wrapper)", async () => {
    // Inline parity with `grist-plugin-api.js`: callers must see rows when
    // they ask for rows, even though the underlying host stub now always
    // returns columnar. Without this, widgets that go through `useGrist`'s
    // `fetchSelectedTable` would silently get the wrong shape compared to
    // production.
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const rows = (await g.fetchSelectedTable({ format: "rows" })) as unknown as Record<
      string,
      unknown
    >[]
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ id: 1, title: "Buy milk" })

    const columnar = (await g.fetchSelectedTable({ format: "columns" })) as Record<
      string,
      unknown[]
    >
    expect(Array.isArray(columnar)).toBe(false)
    expect(columnar.id).toEqual([1, 2, 3])

    emu.dispose()
  })

  it("onRecords receives the row array — non-regression for the row-count bug", async () => {
    // Repro of the user-visible bug: in iframe mode `widget.records` was
    // never populated because the wrapper choked on rows-from-host. Inline
    // mode follows the same contract; assert the row array reaches the
    // listener.
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const onRecords = vi.fn()
    g.onRecords(onRecords, { keepEncoded: false, format: "rows" })
    await g.ready()
    await flush()
    expect(onRecords).toHaveBeenCalled()
    const lastRows = onRecords.mock.calls.at(-1)![0] as Record<string, unknown>[]
    expect(Array.isArray(lastRows)).toBe(true)
    expect(lastRows).toHaveLength(3)
    expect(lastRows[0]).toMatchObject({ id: 1, title: "Buy milk" })
    emu.dispose()
  })

  it("setCursorPos fires onRecord for the new row", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const cb = vi.fn()
    g.onRecord(cb)
    await g.ready()
    await flush()

    cb.mockClear()
    await g.setCursorPos({ rowId: 2 })
    await flush()
    const last = cb.mock.calls.at(-1)![0]
    expect(last).toMatchObject({ id: 2 })
    emu.dispose()
  })

  it("declared columns alone do not produce mappings (manual only)", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    await g.ready({
      columns: [{ name: "title" }, { name: "done", optional: true }, { name: "missing", optional: true }],
    })
    const mappings = await g.sectionApi.mappings()
    expect(mappings).toBeNull()
    emu.dispose()
  })

  it("setColumnMappings sets manual mappings and re-emits onRecord", async () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    const g = emu.grist!
    const onRecord = vi.fn()
    g.onRecord(onRecord)
    await g.ready({
      columns: [{ name: "title" }, { name: "done", optional: true }],
    })
    await flush()
    onRecord.mockClear()
    emu.setColumnMappings({ title: "done", done: "title" })
    await flush()
    expect(onRecord).toHaveBeenCalled()
    expect(onRecord.mock.calls.at(-1)![1]).toEqual({ title: "done", done: "title" })
    const raw = onRecord.mock.calls.at(-1)![0] as Record<string, unknown>
    const mapped = g.mapColumnNames(raw)
    expect(mapped).toEqual({ title: false, done: "Buy milk" })
    emu.setColumnMappings(undefined)
    await flush()
    expect(await g.sectionApi.mappings()).toBeNull()
    emu.dispose()
  })

  it("dispose() removes the global", () => {
    const emu = createGristEmulator({ document: presets.todoList() })
    expect((globalThis as unknown as { grist?: unknown }).grist).toBeDefined()
    emu.dispose()
    expect((globalThis as unknown as { grist?: unknown }).grist).toBeUndefined()
  })
})

function flush(times = 4): Promise<void> {
  let p: Promise<void> = Promise.resolve()
  for (let i = 0; i < times; i++) p = p.then(() => undefined)
  return p
}
