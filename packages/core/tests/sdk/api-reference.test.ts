// The docs' reference (api/reference.json) is generated from the TSDoc: its
// summary and its rows must say what the comments say, no more.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import * as sdk from "../../src/sdk"
import * as actions from "../../src/actions"
import * as app from "../../src/app"
import * as emulator from "../../src/emulator"
import * as emulatorTesting from "../../src/emulator/testing"
// @ts-expect-error: a plain .mjs script, without types
import { reexportsOf, referenceOf, summaryOf } from "../../scripts/api-reference.mjs"

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

describe("reexportsOf", () => {
  it("finds the names re-exported from another package, under their exported name", () => {
    const report = "import { act } from '@testing-library/react';\nimport { screen as screen_2 } from '@testing-library/react';\nimport { Local } from './local';\n\nexport { act }\n\nexport { screen_2 as screen }\n\nexport { Local }\n"
    expect(reexportsOf(report).map((r: { name: string }) => r.name)).toEqual(["act", "screen"])
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

  it("lists every name each entry point exports at run time", () => {
    const modules: Record<string, object> = {
      "grist-widget-sdk": sdk,
      "grist-widget-sdk/app": app,
      "grist-widget-sdk/actions": actions,
      "grist-widget-sdk/emulator": emulator,
      "grist-widget-sdk/emulator/testing": emulatorTesting,
    }
    for (const [entry, module] of Object.entries(modules)) {
      const listed = new Set(reference[entry]!.map((r) => r.name))
      expect(Object.keys(module).filter((name) => !listed.has(name)), entry).toEqual([])
    }
  })
})
