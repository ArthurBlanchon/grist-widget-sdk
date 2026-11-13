import { describe, expect, it } from "vitest"

import {
  DEMO_URL_LENGTH,
  DEMO_URL_PLACEHOLDER,
  demoPageHtml,
  GRIST_STATIC_BASE,
  patchDemoDocument,
} from "../src/demo-page.mjs"

const enc = new TextEncoder()
const dec = new TextDecoder()

/** A stand-in for a .grist file: binary around the section options that hold the placeholder. */
function fakeDocument() {
  const before = new Uint8Array([0, 1, 2, 3, 0x78, 255])
  const options = enc.encode(`{"customView":"{\\"mode\\":\\"url\\",\\"url\\":\\"${DEMO_URL_PLACEHOLDER}\\",\\"access\\":\\"read table\\"}"}`)
  const after = new Uint8Array([9, 8, 7, 0x78, 0x78])
  const bytes = new Uint8Array(before.length + options.length + after.length)
  bytes.set(before)
  bytes.set(options, before.length)
  bytes.set(after, before.length + options.length)
  return { bytes, before, after }
}

describe("patchDemoDocument", () => {
  it("points the document at the widget, keeping every byte around it and the length", () => {
    const { bytes, before, after } = fakeDocument()
    const length = bytes.length
    expect(patchDemoDocument(bytes, "https://owner.github.io/repo/v1.2.0/")).toBe(true)
    expect(bytes.length).toBe(length)
    expect([...bytes.slice(0, before.length)]).toEqual([...before])
    expect([...bytes.slice(-after.length)]).toEqual([...after])
    const text = dec.decode(bytes)
    expect(text).toContain('\\"url\\":\\"https://owner.github.io/repo/v1.2.0/?demo=xxx')
    expect(text).toContain('xxx\\",\\"access\\":\\"read table\\"')
    expect(text).not.toContain("grist-widget-demo.invalid")
  })

  it("keeps a widget URL's own query", () => {
    const { bytes } = fakeDocument()
    patchDemoDocument(bytes, "https://example.com/w/?a=1")
    expect(dec.decode(bytes)).toContain("https://example.com/w/?a=1&demo=x")
  })

  it("refuses a URL longer than the placeholder, and reports a document without one", () => {
    expect(() => patchDemoDocument(fakeDocument().bytes, "https://e.com/" + "a".repeat(DEMO_URL_LENGTH))).toThrow(/too long/)
    expect(patchDemoDocument(enc.encode("no placeholder here"), "https://e.com/")).toBe(false)
  })
})

describe("demoPageHtml", () => {
  it("loads pinned grist-static and runs the same patch function", () => {
    const html = demoPageHtml({ title: "World map" })
    expect(html).toContain(`<script src="${GRIST_STATIC_BASE}latest.js"></script>`)
    expect(GRIST_STATIC_BASE).toMatch(/\/grist-static\/\d+\.\d+\.\d+\/$/)
    expect(html).toContain(patchDemoDocument.toString())
    expect(html).toContain('"widget":"../"')
    expect(html).toContain("<title>World map — demo</title>")
  })

  it("escapes the title in the markup and in the script", () => {
    const html = demoPageHtml({ title: '</script><img src=x onerror=alert(1)>', widget: "../latest/", gristStatic: "/gs/" })
    expect(html).not.toContain("</script><img")
    expect(html).toContain('<script src="/gs/latest.js"></script>')
    expect(html).toContain('"widget":"../latest/"')
  })
})
