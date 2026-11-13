/**
 * Render budget: React render counts for common SDK operations, checked
 * against the committed baseline in `packages/core/bench/results.json`.
 *
 * Check:  `pnpm --filter grist-widget-sdk bench` (CI runs it) — a scenario
 *         that renders more than its baseline fails.
 * Update: `pnpm --filter grist-widget-sdk bench:update` — rewrites the
 *         baseline; commit it when a render change is intended.
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, describe, expect, it } from "vitest"
import React from "react"
import { act, screen, waitFor } from "@testing-library/react"

import { presets } from "../../src/emulator"
import { renderWithGrist } from "../../src/emulator/testing"
import { GristWidgetProvider, useGrist, useGristSchema } from "../../src/sdk"
import { settle, useRenderCount } from "./helpers"

const benchDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../bench")
const resultsPath = path.join(benchDir, "results.json")

type BenchScenario = {
  renders: number
  notes: string
}

const collected: Record<string, BenchScenario> = {}
const updating = process.env.BENCH_UPDATE === "1"
const baseline: Record<string, BenchScenario> = (
  JSON.parse(fs.readFileSync(resultsPath, "utf8")) as { scenarios: Record<string, BenchScenario> }
).scenarios

function record(name: string, renders: number, notes: string) {
  collected[name] = { renders, notes }
  if (updating) return
  const budget = baseline[name]?.renders
  expect(budget, `no baseline for "${name}": run bench:update`).toBeTypeOf("number")
  expect(
    renders,
    `"${name}" rendered ${renders} times, its baseline is ${budget} (bench/results.json). ` +
      "Fix the extra render, or run bench:update if it is intended."
  ).toBeLessThanOrEqual(budget!)
  if (renders < budget!) {
    console.info(`[bench] "${name}" improved: ${renders} renders, baseline ${budget}. Run bench:update.`)
  }
}

function FullGristProbe() {
  const renders = useRenderCount()
  const w = useGrist<{ id: number; title?: string }>()
  return (
    <div data-render-count={renders} data-testid="full-ready">
      {w.status === "ready" ? "ready" : w.status}
      <span data-testid="title">{(w.record?.title as string) ?? ""}</span>
    </div>
  )
}

function WriteBenchProbe({ onTable }: { onTable: (w: ReturnType<typeof useGrist>) => void }) {
  const renders = useRenderCount()
  const w = useGrist()
  onTable(w)
  return (
    <div data-render-count={renders} data-testid="write-ready">
      {w.actionStatus}
    </div>
  )
}

function SchemaBenchProbe({ onSchema }: { onSchema: (s: ReturnType<typeof useGristSchema>) => void }) {
  const renders = useRenderCount()
  // Reading the document's schema needs full access (the emulator enforces it).
  const s = useGristSchema({ replicaRowMode: "schema+samples", requiredAccess: "full" })
  onSchema(s)
  return (
    <div data-render-count={renders} data-testid="schema-state">
      {s.loading ? "loading" : s.error ? "error" : "ready"}
    </div>
  )
}

function readRenderCount(testId: string): number {
  const el = document.querySelector(`[data-testid="${testId}"]`)
  return Number(el?.getAttribute("data-render-count") ?? 0)
}

describe("render budget bench", () => {
  it("fullRecordSubscription — cursor change", async () => {
    const { emulator } = renderWithGrist(
      <GristWidgetProvider options={{ requiredAccess: "read table" }}>
        <FullGristProbe />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    await waitFor(() => expect(screen.getByTestId("full-ready")).toHaveTextContent("ready"))
    await waitFor(() => expect(screen.getByTestId("title")).toHaveTextContent("Buy milk"))
    const before = readRenderCount("full-ready")

    await act(async () => {
      emulator.selectRow(2)
      await settle()
    })
    await waitFor(() => expect(screen.getByTestId("title")).toHaveTextContent("Write the SOTA emulator"))

    const renders = readRenderCount("full-ready") - before
    record(
      "fullRecordSubscription",
      renders,
      "useGrist() subscriber re-renders when selection changes (todoList, selectRow 1→2)"
    )
    expect(renders).toBeGreaterThanOrEqual(1)
    expect(renders).toBeLessThanOrEqual(8)
    emulator.dispose()
  })

  it("write — table.create", async () => {
    let captured: ReturnType<typeof useGrist> | undefined
    const { emulator } = renderWithGrist(
      <GristWidgetProvider options={{ requiredAccess: "full" }}>
        <WriteBenchProbe onTable={(w) => (captured = w)} />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    await waitFor(() => expect(screen.getByTestId("write-ready")).toHaveTextContent("idle"))
    await waitFor(() => expect(captured?.table?.create).toBeTruthy())
    const before = readRenderCount("write-ready")

    await act(async () => {
      await captured!.table.create({
        fields: { title: "Bench row", done: false, priority: "low" },
      })
      await settle()
    })
    await waitFor(() =>
      expect(screen.getByTestId("write-ready")).toHaveTextContent(/^(idle|running)$/)
    )

    const renders = readRenderCount("write-ready") - before
    record("write", renders, "useGrist() subscriber re-renders across table.create")
    expect(renders).toBeGreaterThanOrEqual(0)
    expect(renders).toBeLessThanOrEqual(10)
    emulator.dispose()
  })

  it("schemaFetch — reload", async () => {
    let captured: ReturnType<typeof useGristSchema> | undefined
    const { emulator } = renderWithGrist(
      <GristWidgetProvider options={{ requiredAccess: "full" }}>
        <SchemaBenchProbe onSchema={(s) => (captured = s)} />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent("ready"))
    await waitFor(() => expect(captured?.reload).toBeTruthy())
    const before = readRenderCount("schema-state")

    await act(async () => {
      await captured!.reload()
      await settle()
    })
    await waitFor(() => expect(screen.getByTestId("schema-state")).toHaveTextContent("ready"))

    const renders = readRenderCount("schema-state") - before
    record("schemaFetch", renders, "useGristSchema() subscriber re-renders on reload()")
    expect(renders).toBeGreaterThanOrEqual(1)
    expect(renders).toBeLessThanOrEqual(8)
    emulator.dispose()
  })
})

afterAll(() => {
  if (!updating) return
  const payload = {
    version: 1,
    environment: "jsdom+vitest",
    fixture: "presets.todoList()",
    scenarios: collected,
  }
  fs.mkdirSync(benchDir, { recursive: true })
  fs.writeFileSync(resultsPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
})
