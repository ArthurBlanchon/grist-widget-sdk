/**
 * Vitest helpers to assert what the widget did to the document.
 *
 * Usage:
 *
 *   const { emulator } = renderWithGrist(<MyWidget />)
 *   await userEvent.click(screen.getByText("Add"))
 *   expect(actionsOf(emulator)).toContainEqual(["AddRecord", "Tasks", null, { title: "X" }])
 */

import type { GristEmulator } from "../create-grist-emulator"
import type { EmulatorEvent } from "../core/event-bus"

/** Every user action the widget sent the emulator, oldest first: `["UpdateRecord", "Tasks", 1, { Done: true }]`. */
export function actionsOf(emulator: GristEmulator): unknown[][] {
  return emulator.bus
    .history()
    .filter((e: EmulatorEvent): e is Extract<EmulatorEvent, { type: "user-action" }> => e.type === "user-action")
    .map((e) => e.action as unknown[])
}

/** Every event on the emulator's bus, oldest first: ready, cursor, data, options, theme and user actions. */
export function eventsOf(emulator: GristEmulator): readonly EmulatorEvent[] {
  return emulator.bus.history()
}

/** Bus event kinds aligned with grist host callbacks (see inline transport). */
export type WaitForEventKind = "ready" | "record" | "records" | "options" | "theme" | "cursor"

/** `waitForEvent()`'s options: how long to wait, in ms (default 1000). */
export type WaitForEventOptions = {
  timeoutMs?: number
}

function predicateForKind(kind: WaitForEventKind): (event: EmulatorEvent) => boolean {
  switch (kind) {
    case "ready":
      return (e) => e.type === "ready"
    case "record":
    case "cursor":
      return (e) => e.type === "cursor-change"
    case "records":
      return (e) => e.type === "data-change"
    case "options":
      return (e) => e.type === "options-change"
    case "theme":
      return (e) => e.type === "theme-change"
  }
}

function waitForNextEvent(
  emulator: GristEmulator,
  predicate: (event: EmulatorEvent) => boolean,
  timeoutMs: number,
  label?: string
): Promise<EmulatorEvent> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off()
      const hint = label ? ` (kind: ${label})` : ""
      const recent = emulator.bus
        .history()
        .slice(-5)
        .map((e) => e.type)
        .join(", ")
      reject(
        new Error(
          `waitForEvent timed out after ${timeoutMs}ms${hint}.` +
            (recent ? ` Recent bus events: ${recent}.` : " No bus events yet.")
        )
      )
    }, timeoutMs)
    const off = emulator.bus.on((event) => {
      if (predicate(event)) {
        clearTimeout(timer)
        off()
        resolve(event)
      }
    })
  })
}

/**
 * Resolves with the next event of a kind on the emulator's bus, or rejects
 * after the timeout, naming the last events seen.
 */
export function waitForEvent(
  emulator: GristEmulator,
  kind: WaitForEventKind,
  options?: WaitForEventOptions
): Promise<EmulatorEvent>
/** Resolves with the next event the predicate accepts, or rejects after `timeoutMs` (default 1000). */
export function waitForEvent(
  emulator: GristEmulator,
  predicate: (event: EmulatorEvent) => boolean,
  timeoutMs?: number
): Promise<EmulatorEvent>
export function waitForEvent(
  emulator: GristEmulator,
  kindOrPredicate: WaitForEventKind | ((event: EmulatorEvent) => boolean),
  timeoutOrOptions: number | WaitForEventOptions = 1000
): Promise<EmulatorEvent> {
  if (typeof kindOrPredicate === "string") {
    const opts = typeof timeoutOrOptions === "object" ? timeoutOrOptions : {}
    const timeoutMs = opts.timeoutMs ?? 1000
    return waitForNextEvent(emulator, predicateForKind(kindOrPredicate), timeoutMs, kindOrPredicate)
  }
  const timeoutMs = typeof timeoutOrOptions === "number" ? timeoutOrOptions : 1000
  return waitForNextEvent(emulator, kindOrPredicate, timeoutMs)
}
