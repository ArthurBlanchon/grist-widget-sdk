// The docs' reference (api/reference.json) is generated from the TSDoc: its
// summary and its rows must say what the comments say, no more.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// @ts-expect-error: a plain .mjs script, without types
import { referenceOf, summaryOf } from "../../scripts/api-reference.mjs"

describe("summaryOf", () => {
  it("keeps the first paragraph, on one line, without tags or code", () => {
    const doc = "/**\n * Render a widget\n * into the page.\n *\n * More.\n * @param x - y\n */"
    expect(summaryOf(doc)).toBe("Render a widget into the page.")
    expect(summaryOf("/**\n * Before.\n * ```ts\n * code()\n * ```\n */")).toBe("Before.")
    expect(summaryOf("/** One line. */")).toBe("One line.")
    expect(summaryOf(undefined)).toBe("")
  })

  it("turns links into code, or their label", () => {
    expect(summaryOf("/** See {@link GristBoundary}, {@link useGrist | the hook}. */")).toBe(
      "See `GristBoundary`, the hook."
    )
  })
})

describe("referenceOf", () => {
  const model = {
    members: [
      {
        kind: "EntryPoint",
        members: [
          { kind: "TypeAlias", name: "B", docComment: "/** A type. */", excerptTokens: [{ text: "type B = 1;" }] },
          { kind: "Function", name: "a", docComment: "", excerptTokens: [{ text: "declare function a(x: 1): void;" }] },
          { kind: "Function", name: "a", docComment: "/** Does a. */", excerptTokens: [{ text: "declare function a(): void;" }] },
        ],
      },
    ],
  }

  it("gives one row per name, overloads together, sorted", () => {
    expect(referenceOf(model)).toEqual([
      { name: "a", kind: "function", summary: "Does a.", signatures: ["a(x: 1): void", "a(): void"] },
      { name: "B", kind: "type", summary: "A type." },
    ])
  })
})

describe("api/reference.json", () => {
  const reference = JSON.parse(readFileSync(join(__dirname, "../../api/reference.json"), "utf8")) as Record<
    string,
    { name: string; summary: string }[]
  >

  it("covers every entry point, and every name has its summary", () => {
    expect(Object.keys(reference)).toEqual([
      "grist-widget-sdk",
      "grist-widget-sdk/app",
      "grist-widget-sdk/actions",
      "grist-widget-sdk/emulator",
      "grist-widget-sdk/emulator/testing",
    ])
    const missing = Object.entries(reference).flatMap(([entry, rows]) => rows.filter((r) => !r.summary).map((r) => `${entry}: ${r.name}`))
    expect(missing).toEqual([])
  })
})
