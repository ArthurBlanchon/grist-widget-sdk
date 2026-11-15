import { describe, expect, it } from "vitest"

import { httpUrl } from "../../src/sdk"

describe("httpUrl", () => {
  it("keeps an absolute http(s) URL, normalised", () => {
    expect(httpUrl("https://example.com")).toBe("https://example.com/")
    expect(httpUrl("  http://example.com/a b?q=1#x ")).toBe("http://example.com/a%20b?q=1#x")
    expect(httpUrl("HTTPS://EXAMPLE.com/Path")).toBe("https://example.com/Path")
  })

  it("refuses the schemes a cell can attack with", () => {
    for (const value of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.com/uuid",
      "mailto:a@example.com",
      "ftp://example.com",
    ]) {
      expect(httpUrl(value), value).toBeUndefined()
    }
  })

  it("refuses relative URLs, which would resolve against the widget's origin", () => {
    for (const value of ["/admin", "example.com", "//example.com/x", "?q=1", "#top"]) {
      expect(httpUrl(value), value).toBeUndefined()
    }
  })

  it("refuses credentials, which disguise the host", () => {
    expect(httpUrl("https://bank.example@evil.example/")).toBeUndefined()
    expect(httpUrl("https://user:pass@example.com/")).toBeUndefined()
  })

  it("refuses what isn't a non-empty string", () => {
    for (const value of [undefined, null, 42, "", "   ", ["L", "https://example.com"], { href: "https://example.com" }]) {
      expect(httpUrl(value)).toBeUndefined()
    }
  })
})
