/**
 * Ensures a consumer can re-export SDK hooks with *inferred* types and still
 * emit declarations — the setup of any library or design system built on top
 * of the SDK (`declaration: true`).
 *
 * tsup splits types shared by several entries into hashed chunks
 * (`dist/<name>-<hash>.d.ts`) that the package `exports` map does not expose.
 * If a public signature reaches a type that only such a chunk exports, the
 * consumer's declaration emit cannot name it and fails with TS2883 (TS2742
 * before TypeScript 6): "The inferred type of 'X' cannot be named without a
 * reference to '…/dist/use-grist-…'". tsup reports the same thing at build
 * time as "[plugin dts] … private shared type exports with no public
 * re-export"; this test turns that warning into a failure.
 *
 * Run after `pnpm --filter grist-widget-sdk build`.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import ts from "typescript"
import { afterAll, describe, expect, it } from "vitest"

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "../..")

// One inferred-type re-export per public hook family — each line makes the
// emitter name every type the hook's signature reaches.
const consumerSource = `
import { useGrist, useGristOptional, useGristSchema } from "grist-widget-sdk"

export function useWidget() { return useGrist() }
export function useMaybeWidget() { return useGristOptional() }
export function useSchema() { return useGristSchema() }
`

const consumerDir = mkdtempSync(join(tmpdir(), "grist-widget-sdk-consumer-"))

afterAll(() => {
  rmSync(consumerDir, { recursive: true, force: true })
})

describe("dist declaration emit", () => {
  it("lets a consumer re-export hooks without naming private chunk types", () => {
    // A real node_modules layout, so module resolution goes through the
    // package's `exports` map exactly as an installed copy would.
    mkdirSync(join(consumerDir, "node_modules"))
    symlinkSync(packageDir, join(consumerDir, "node_modules", "grist-widget-sdk"), "dir")
    const entry = join(consumerDir, "index.ts")
    writeFileSync(entry, consumerSource)

    const program = ts.createProgram({
      rootNames: [entry],
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        strict: true,
        declaration: true,
        emitDeclarationOnly: true,
        // Without it the symlink resolves to packages/core, outside any
        // node_modules — the emitter could then write a relative import to
        // the chunk and the failure this test guards against would not show.
        preserveSymlinks: true,
        skipLibCheck: true,
        rootDir: consumerDir,
        types: [],
      },
    })

    // With `declaration: true`, pre-emit diagnostics include the declaration
    // emitter's — nothing needs to be written to disk.
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))

    expect(diagnostics).toEqual([])
  })
})
