/**
 * `smokeTestWidget()` / `installJsdomStubs()` — see /docs/emulator/testing
 *
 * Passes for a widget that renders past the boundary with its columns
 * mapped; fails with the widget's own error when it throws, and with what
 * the page showed when it never gets there.
 */
import { afterEach, describe, expect, it } from "vitest"
import { useEffect, useRef } from "react"

import { useGrist } from "../../src/sdk"
import { installJsdomStubs, smokeTestWidget } from "../../src/emulator/testing"

afterEach(() => {
  Object.defineProperty(window, "top", { configurable: true, get: () => window.self })
})

function Titled() {
  const w = useGrist()
  return <p>{String(w.record?.Title ?? "no row")}</p>
}

describe("smokeTestWidget()", () => {
  it("passes for a widget without declared columns", async () => {
    await smokeTestWidget({ App: () => <p>hello</p>, options: { requiredAccess: "read table" } })
  })

  it("maps every declared column, single and multiple, on a document it builds from them", async () => {
    const seen: { status: unknown } = { status: null }
    function Widget() {
      const w = useGrist()
      useEffect(() => {
        seen.status = w.columnMappingStatus
      })
      return <Titled />
    }
    await smokeTestWidget({
      App: Widget,
      options: {
        requiredAccess: "read table",
        columns: [
          "Title",
          { name: "Amount", type: "Numeric" },
          { name: "Done", type: "Bool,Any" },
          { name: "Tags", type: "Text", allowMultiple: true },
          { name: "When", type: "Date", optional: true },
        ],
      },
    })
    expect(seen.status).toMatchObject({ ok: true })
  })

  it("grants the access the widget requests, as the user would in Grist", async () => {
    const granted: unknown[] = []
    function Probe() {
      const w = useGrist()
      useEffect(() => {
        granted.push(w.status)
      })
      return <p>probe</p>
    }
    await smokeTestWidget({ App: Probe, options: { requiredAccess: "full" } })
    // Granted as requested: a "full" widget isn't refused (status "error").
    expect(granted.at(-1)).toBe("ready")
  })

  it("fails with the widget's own error when it throws", async () => {
    function Broken(): never {
      throw new Error("boom in render")
    }
    await expect(
      smokeTestWidget({ App: Broken, options: { requiredAccess: "read table" }, timeout: 2_000 })
    ).rejects.toThrow("boom in render")
  })

  it("fails with what the page showed when the widget never renders", async () => {
    await expect(
      smokeTestWidget({ App: () => null, options: { requiredAccess: "read table" }, timeout: 500 })
    ).rejects.toThrow(/didn't render past GristBoundary within 500 ms\. The page showed: /)
  })
})

describe("installJsdomStubs()", () => {
  it("adds ResizeObserver and matchMedia when missing, and keeps a test's own", () => {
    const previous = window.matchMedia
    const own = () => ({ matches: true }) as unknown as MediaQueryList
    try {
      window.matchMedia = own
      // @ts-expect-error -- removing jsdom's absent API on purpose
      delete globalThis.ResizeObserver
      installJsdomStubs()
      expect(window.matchMedia).toBe(own)
      expect(typeof ResizeObserver).toBe("function")
      expect(() => new ResizeObserver(() => {}).observe(document.body)).not.toThrow()

      // @ts-expect-error -- back to jsdom's missing matchMedia
      delete window.matchMedia
      installJsdomStubs()
      expect(window.matchMedia("(prefers-color-scheme: dark)").matches).toBe(false)
    } finally {
      window.matchMedia = previous
    }
  })

  it("lets components that measure themselves render", async () => {
    function Measured() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const observer = new ResizeObserver(() => {})
        if (ref.current) observer.observe(ref.current)
        return () => observer.disconnect()
      }, [])
      return <div ref={ref}>measured</div>
    }
    await smokeTestWidget({ App: Measured, options: { requiredAccess: "read table" } })
  })
})
