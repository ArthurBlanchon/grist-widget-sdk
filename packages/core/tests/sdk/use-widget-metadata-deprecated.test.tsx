import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { useWidgetMetadata } from "../../src/sdk"

describe("useWidgetMetadata (deprecated)", () => {
  it("still sets the page's title, and warns once in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    function Page() {
      useWidgetMetadata({ title: "Old page", description: "d" })
      return null
    }
    render(<Page />)
    render(<Page />)
    expect(document.title).toBe("Old page")
    expect(warn.mock.calls.filter(([m]) => String(m).includes("useWidgetMetadata() is deprecated"))).toHaveLength(1)
    warn.mockRestore()
  })
})
