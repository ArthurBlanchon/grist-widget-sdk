/**
 * Test entry point — `grist-widget-sdk/emulator/testing`.
 *
 * Bundles `renderWithGrist`, matchers, document presets, and the most-used
 * @testing-library/react primitives so a typical test file only needs one
 * import line:
 *
 *   import {
 *     renderWithGrist, presets, screen, fireEvent, waitFor, actionsOf,
 *   } from "grist-widget-sdk/emulator/testing"
 */

export { renderWithGrist } from "./render-with-grist"
export type {
  RenderWithGristOptions,
  RenderWithGristResult,
} from "./render-with-grist"

export { smokeTestWidget, type SmokeTestWidgetOptions } from "./smoke-test-widget"
export { installJsdomStubs } from "./jsdom-stubs"

export {
  actionsOf,
  eventsOf,
  waitForEvent,
  type WaitForEventKind,
  type WaitForEventOptions,
} from "./matchers"

// Document fixtures (re-export from the emulator entry for convenience).
export { presets } from "../templates"

// @testing-library/react convenience re-exports — see AGENTS.md
export {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
export type { RenderOptions, RenderResult } from "@testing-library/react"
