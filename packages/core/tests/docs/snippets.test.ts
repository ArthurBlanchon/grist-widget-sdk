/**
 * Type-checks every ```tsx block in apps/www/content/docs/**\/*.mdx.
 *
 * This is the "docs" vitest project's only test file -- until this file
 * existed, `pnpm test` ran the project and passed with zero tests, so
 * nothing verified a documented code sample actually compiles (S-02). A
 * doc-sample bug that shipped silently once already (W-12) is exactly the
 * failure mode this closes.
 *
 * Regenerates .generated/ on every run (see extract-doc-snippets.mjs) rather
 * than trusting a committed copy stays in sync with the docs corpus --
 * the same self-healing-generated-file pattern as widgets.json.
 */
import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

import { extractDocSnippets, generatedDir } from "../../../../scripts/extract-doc-snippets.mjs"

const execFileAsync = promisify(execFile)
const testsDocsDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(testsDocsDir, "../../../..")
const tscBin = join(repoRoot, "packages/core/node_modules/.bin/tsc")

describe("documented code samples", () => {
  it("extracts at least one snippet per known-nonempty doc page", () => {
    const manifest = extractDocSnippets()
    // A regression guard on the extractor itself: if this drops to 0, the
    // fence regex broke, not the docs corpus going empty -- fail loudly
    // rather than let the type-check step below pass vacuously.
    expect(manifest.length).toBeGreaterThan(30)
  })

  it("type-checks clean with tsc", async () => {
    extractDocSnippets()
    try {
      await execFileAsync(tscBin, ["-p", join(testsDocsDir, "tsconfig.snippets.json")], {
        cwd: testsDocsDir,
      })
    } catch (err) {
      const manifest = JSON.parse(readFileSync(join(generatedDir, "manifest.json"), "utf8"))
      const stdout = /** @type {{ stdout?: string; stderr?: string }} */ (err).stdout ?? ""
      const stderr = /** @type {{ stdout?: string; stderr?: string }} */ (err).stderr ?? ""
      const hint = manifest
        .filter((m) => !m.skipped)
        .map((m) => `  ${m.generated}  <-  ${m.source} (block #${m.blockIndex})`)
        .join("\n")
      throw new Error(
        `tsc found type errors in one or more documented code samples:\n\n${stdout}${stderr}\n` +
          `Generated file -> source .mdx mapping:\n${hint}`,
        { cause: err },
      )
    }
  })
})
