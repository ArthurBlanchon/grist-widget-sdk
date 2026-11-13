/**
 * `mapBack` + `allowMultiple` contract — see /guide/column-mapping#allow-multiple-recipes
 *
 * - `mapBack(patch)` returns a `Record<string, unknown>` with single-mapped
 *   columns reverse-mapped, and `allowMultiple` columns skipped.
 * - The list of skipped logical names is surfaced to the alerts
 *   on the selection slice (and on `useGrist()`), updated reactively after
 *   the next `mapBack(...)` call.
 * - The widget's alerts include a `kind: "map-back-skip"` one while columns
 *   were skipped.
 */

import { describe, expect, it } from "vitest"
import React from "react"
import { act, screen, waitFor } from "@testing-library/react"

import {
  GristWidgetProvider,
  useGrist,
} from "../../src/sdk"
import { renderWithGrist } from "../../src/emulator/testing"
import { useGristSdkAlerts } from "../../src/sdk/helpers/grist-sdk-alerts"
import { presets } from "../../src/emulator"

type Mapped = { Title: string; Done: boolean; Tags?: string[] }

function MapBackProbe({
  patchFactory,
}: {
  patchFactory: () => Partial<Mapped>
}) {
  const w = useGrist<Record<string, unknown>, Mapped>()
  const alerts = useGristSdkAlerts()
  return (
    <div>
      <span data-testid="status">{w.status}</span>
      <span data-testid="tags-mapping">
        {JSON.stringify((w.mappings as Record<string, unknown>).Tags ?? null)}
      </span>
      <span data-testid="skipped">
        {alerts.find((a) => a.kind === "map-back-skip")?.message ?? "<empty>"}
      </span>
      <span data-testid="last-patch" data-payload="null" />
      <span data-testid="alert-ids">
        {alerts
          .map((a) => a.id)
          .join(",") || "<empty>"}
      </span>
      <button
        data-testid="run"
        onClick={() => {
          const result = w.mapBack(patchFactory())
          document
            .querySelector('[data-testid="last-patch"]')
            ?.setAttribute("data-payload", JSON.stringify(result))
        }}
      >
        run
      </button>
    </div>
  )
}

function applyMappings(emulator: ReturnType<typeof renderWithGrist>["emulator"]) {
  emulator.setColumnMappings({
    Title: "title",
    Done: "done",
    Tags: ["tag_a", "tag_b"],
  })
}

describe("mapBack() + allowMultiple", () => {
  it("skips allowMultiple columns and reports them on mapBackSkipped + alert", async () => {
    const { emulator } = renderWithGrist(
      <GristWidgetProvider
        options={{
          requiredAccess: "read table",
          columns: [
            { name: "Title", type: "Text" },
            { name: "Done", type: "Bool" },
            { name: "Tags", type: "ChoiceList", allowMultiple: true },
          ],
        }}
      >
        <MapBackProbe patchFactory={() => ({ Done: true, Tags: ["a", "b"] })} />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"))

    await act(async () => {
      applyMappings(emulator)
    })

    // Wait for the mappings event to propagate into React state.
    await waitFor(() =>
      expect(screen.getByTestId("tags-mapping")).toHaveTextContent('["tag_a","tag_b"]')
    )

    // Initially no skip, no alert (mapBack hasn't run yet).
    expect(screen.getByTestId("skipped")).toHaveTextContent("<empty>")

    await act(async () => {
      screen.getByTestId("run").click()
    })

    await waitFor(() =>
      expect(screen.getByTestId("skipped")).toHaveTextContent("Tags")
    )
    await waitFor(() =>
      expect(screen.getByTestId("alert-ids")).toHaveTextContent("map-back-skip")
    )

    // Sanity: the returned patch only contains the single-mapped field.
    const payload = screen
      .getByTestId("last-patch")
      .getAttribute("data-payload")
    expect(payload).toBeTruthy()
    expect(JSON.parse(payload!)).toEqual({ done: true })
  })

  it("clears mapBackSkipped when a later call has no allowMultiple keys", async () => {
    const { emulator, rerender } = renderWithGrist(
      <GristWidgetProvider
        options={{
          requiredAccess: "read table",
          columns: [
            { name: "Title", type: "Text" },
            { name: "Done", type: "Bool" },
            { name: "Tags", type: "ChoiceList", allowMultiple: true },
          ],
        }}
      >
        <MapBackProbe patchFactory={() => ({ Done: true, Tags: ["a", "b"] })} />
      </GristWidgetProvider>,
      { emulator: { document: presets.todoList() } }
    )

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ready"))
    await act(async () => applyMappings(emulator))
    await waitFor(() =>
      expect(screen.getByTestId("tags-mapping")).toHaveTextContent('["tag_a","tag_b"]')
    )

    await act(async () => screen.getByTestId("run").click())
    await waitFor(() =>
      expect(screen.getByTestId("skipped")).toHaveTextContent("Tags")
    )

    // Re-render the probe with a patch that doesn't mention Tags.
    rerender(
      <GristWidgetProvider
        options={{
          requiredAccess: "read table",
          columns: [
            { name: "Title", type: "Text" },
            { name: "Done", type: "Bool" },
            { name: "Tags", type: "ChoiceList", allowMultiple: true },
          ],
        }}
      >
        <MapBackProbe patchFactory={() => ({ Done: false })} />
      </GristWidgetProvider>
    )

    await act(async () => screen.getByTestId("run").click())
    await waitFor(() =>
      expect(screen.getByTestId("skipped")).toHaveTextContent("<empty>")
    )
  })
})
