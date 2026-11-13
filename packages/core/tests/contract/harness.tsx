/**
 * Shared harness for the contract tests: a widget that publishes its
 * `useGrist()` result, rendered in the emulator with public entry points only.
 */

import React from "react"
import { act, waitFor } from "@testing-library/react"

import { GristBoundary, GristWidgetProvider, useGrist, type UseGristOptions, type UseGristResult } from "../../src/sdk"
import { presets, renderWithGrist, type RenderWithGristOptions } from "../../src/emulator/testing"

export type Latest = { current: UseGristResult | null }

function Probe({ latest }: { latest: Latest }) {
  latest.current = useGrist()
  return <span data-testid="probe">{latest.current.status}</span>
}

export function renderProbe(
  options: UseGristOptions = { requiredAccess: "read table" },
  render: RenderWithGristOptions = {},
  { boundary = false }: { boundary?: boolean } = {}
) {
  const latest: Latest = { current: null }
  const probe = <Probe latest={latest} />
  const result = renderWithGrist(
    <GristWidgetProvider options={options}>{boundary ? <GristBoundary>{probe}</GristBoundary> : probe}</GristWidgetProvider>,
    { emulator: { document: presets.todoList() }, ...render }
  )
  const w = () => {
    if (!latest.current) throw new Error("the probe has not rendered")
    return latest.current
  }
  return { ...result, latest, w }
}

export async function untilReady(w: () => UseGristResult) {
  await waitFor(() => expect(w().status).toBe("ready"))
}

/** Run `fn` inside act() and let the emulator's async deliveries settle. */
export async function settle(fn?: () => unknown) {
  await act(async () => {
    await fn?.()
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
  })
}
