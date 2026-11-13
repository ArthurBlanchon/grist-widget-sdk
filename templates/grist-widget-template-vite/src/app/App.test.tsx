/**
 * The widget's behaviour, against an emulated Grist: `renderWithGrist` runs
 * it as `mountGristWidget()` does inside Grist, with a table built from the
 * declared columns, mapped, and seeded with `rows` (typed as the widget reads
 * them). No browser, no real Grist document. Copy this pattern for new tests.
 */
import "@testing-library/jest-dom/vitest"
import { afterEach, expect, it } from "vitest"
import {
  cleanup,
  fireEvent,
  renderWithGrist,
  screen,
  waitFor,
} from "grist-widget-sdk/emulator/testing"

import App, { widget } from "./App"

// Not using vitest's `globals: true` (see vite.config.ts), so Testing
// Library's automatic cleanup never registers itself: do it here.
afterEach(() => cleanup())

it("shows the selected task", async () => {
  renderWithGrist(<App />, {
    widget,
    rows: [{ Title: "Buy milk", Done: false }],
  })
  expect(
    await screen.findByRole("heading", { name: "Buy milk" })
  ).toBeInTheDocument()
})

it("marks it done in Grist", async () => {
  const { emulator } = renderWithGrist(<App />, {
    widget,
    rows: [{ Title: "Buy milk", Done: false }],
  })
  fireEvent.click(await screen.findByRole("button", { name: "Mark as done" }))
  await waitFor(() =>
    expect(emulator.state.tables.get("Table1")!.rows[0]).toMatchObject({
      Done: true,
    })
  )
  expect(
    await screen.findByRole("button", { name: "Mark as not done" })
  ).toBeInTheDocument()
})
