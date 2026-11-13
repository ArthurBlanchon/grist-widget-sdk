/**
 * How writes report their state: overlapping writes, and a failed write
 * nobody awaits. The order the promises settle in is controlled here, which
 * the emulator can't do.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

import { createGristApi } from "../../src/sdk/runtime/api"
import { initialRuntimeState, type GristRuntime, type GristRuntimeState } from "../../src/sdk/runtime/runtime"

function deferred() {
  let resolve!: (v?: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

function fakeRuntime() {
  let state: GristRuntimeState = { ...initialRuntimeState(), connection: "ready" }
  const runtime: GristRuntime = {
    options: {},
    getState: () => state,
    subscribe: () => () => {},
    start: () => () => {},
    reload: async () => {},
    update: (patch) => void (state = { ...state, ...patch }),
  }
  return runtime
}

const flush = () => new Promise((r) => setTimeout(r, 0))

afterEach(() => {
  delete (globalThis as { grist?: unknown }).grist
})

describe("writes", () => {
  it("stay running until the last overlapping write ends, then report a failure among them", async () => {
    const first = deferred()
    const second = deferred()
    const calls = [first, second]
    ;(globalThis as { grist?: unknown }).grist = { docApi: { applyUserActions: () => calls.shift()!.promise } }
    const runtime = fakeRuntime()
    const api = createGristApi(runtime)

    const a = api.applyActions([["AddRecord", "T", null, {}]])
    const b = api.applyActions([["AddRecord", "T", null, {}]])
    expect(runtime.getState().actionStatus).toBe("running")

    second.reject(new Error("boom"))
    await b.catch(() => {})
    expect(runtime.getState().actionStatus).toBe("running")

    first.resolve({ retValues: [] })
    await a
    expect(runtime.getState()).toMatchObject({ actionStatus: "error", actionError: "boom" })
  })

  it("start a new run clean: the next write clears the last error", async () => {
    ;(globalThis as { grist?: unknown }).grist = {
      docApi: { applyUserActions: vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({}) },
    }
    const runtime = fakeRuntime()
    const api = createGristApi(runtime)
    await api.applyActions([]).catch(() => {})
    expect(runtime.getState().actionStatus).toBe("error")
    await api.applyActions([])
    expect(runtime.getState()).toMatchObject({ actionStatus: "idle", actionError: null })
  })

  it("can go unawaited: a failure is reported in the state, not as an unhandled rejection", async () => {
    ;(globalThis as { grist?: unknown }).grist = { docApi: { applyUserActions: () => Promise.reject(new Error("boom")) } }
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    try {
      const runtime = fakeRuntime()
      void createGristApi(runtime).applyActions([])
      await flush()
      await flush()
      expect(runtime.getState().actionStatus).toBe("error")
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })

  it("still reject for whoever awaits them", async () => {
    ;(globalThis as { grist?: unknown }).grist = { docApi: { applyUserActions: () => Promise.reject(new Error("boom")) } }
    await expect(createGristApi(fakeRuntime()).applyActions([])).rejects.toThrow("boom")
  })
})
