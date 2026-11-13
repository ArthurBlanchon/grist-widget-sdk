#!/usr/bin/env node
// Extracts every fenced ```tsx block from apps/www/content/docs/**/*.mdx and
// writes each to packages/core/tests/docs/.generated/ as a real .tsx file, so
// packages/core/tests/docs/snippets.test.ts can type-check the whole corpus
// with `tsc`. Closes S-01/S-02's "docs" vitest project: it points at this
// directory and currently has zero test files, so `pnpm test` passes with
// nothing actually verifying a documented code sample compiles (the
// mechanism that would have caught W-12, a real doc-sample bug that shipped
// silently once already).
//
// Snippet shapes vary a lot across the corpus (see the two branches below):
// some are complete standalone files with their own imports (quickstart.mdx),
// most are bare fragments -- a function body, an `if` block, a single JSX
// expression -- that assume `w` (useGrist()'s return value) and a handful of
// illustrative placeholder names (MyRow, MyWidget, CreateRowForm, ...) are
// already in scope from surrounding prose. Two harness strategies handle
// both without trying to fully infer either:
//
//   - self-contained (starts with `import`/`export`): used as-is.
//   - fragment: wrapped in a synthetic function so bare `return`/JSX
//     statements are valid, with `w` supplied.
//
// Either way, every name (real SDK/react import, or illustrative
// placeholder) the snippet actually references gets supplied -- see
// KNOWN_NAMES + supplyFor() -- unless the snippet already brings that name
// into scope itself. A snippet naming something not in KNOWN_NAMES fails to
// compile with an "unknown name" error pointing at the generated file --
// the fix is adding an entry there, not relaxing the check.
//
// A third category exists: some fences aren't meant to compile against this
// package at all -- an unclosed JSX tag left open on purpose
// ("<GristWidgetProvider ...>", no closing tag, because the surrounding
// prose is the point), a literal `options={...}` where `...` means "some
// props go here" in prose rather than real spread syntax, or a snippet for a
// different framework entirely (a Next.js layout importing "next/script" --
// packages/core has no reason to depend on next just to type-check a docs
// sample). Forcing any of these to compile would make the docs worse, not
// better. Mark them `tsx no-check` (as the fence's info string, e.g.
// ` ```tsx no-check `) and they're skipped entirely, not silently passed --
// see the manifest's `skipped` entries.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
export const docsDir = join(repoRoot, "apps/www/content/docs")
export const generatedDir = join(repoRoot, "packages/core/tests/docs/.generated")

const FENCE_OPEN = /^```tsx(\s+(?<info>\S+))?\s*$/
const FENCE_CLOSE = /^```\s*$/

/**
 * Every name this harness can supply on request, real or illustrative.
 * `kind: "import"` names come from a real module (the SDK, react, or the
 * emulator testing helpers); `kind: "ambient"` names are illustrative
 * stand-ins the docs corpus uses for "your own type/component" (MyRow,
 * CreateRowForm, ...) that no real import can cover.
 *
 * Reference-driven, not "self-contained vs fragment": every generated file
 * gets exactly the entries whose name it textually references (`\bNAME\b`)
 * and does not already bring into scope itself (an import naming it, or a
 * local function/const/type/class declaration) -- see supplyFor() below.
 * This is what makes a snippet that already writes its own
 * `import { useGrist } from "grist-widget-sdk"` not get a second,
 * conflicting one, while a snippet that uses `useGrist` without importing it
 * (most of the corpus) still gets one.
 *
 * A snippet naming something not listed here fails to compile with an
 * "unknown name" error pointing at the generated file -- the fix is adding
 * an entry, not relaxing the check.
 */
const KNOWN_NAMES = [
  // Real SDK / react / testing-helper imports.
  { name: "useGrist", kind: "import", line: 'import { useGrist } from "grist-widget-sdk"' },
  { name: "useGristOptional", kind: "import", line: 'import { useGristOptional } from "grist-widget-sdk"' },
  { name: "useGristSchema", kind: "import", line: 'import { useGristSchema } from "grist-widget-sdk"' },
  { name: "GristBoundary", kind: "import", line: 'import { GristBoundary } from "grist-widget-sdk"' },
  { name: "GristWidgetProvider", kind: "import", line: 'import { GristWidgetProvider } from "grist-widget-sdk"' },
  { name: "gristAddColumnAction", kind: "import", line: 'import { gristAddColumnAction } from "grist-widget-sdk"' },
  { name: "gristRenameColumnAction", kind: "import", line: 'import { gristRenameColumnAction } from "grist-widget-sdk"' },
  { name: "UseGristOptions", kind: "import", line: 'import type { UseGristOptions } from "grist-widget-sdk"' },
  { name: "presets", kind: "import", line: 'import { presets } from "grist-widget-sdk/emulator/testing"' },
  { name: "renderWithGrist", kind: "import", line: 'import { renderWithGrist } from "grist-widget-sdk/emulator/testing"' },
  { name: "useState", kind: "import", line: 'import { useState } from "react"' },
  { name: "useMemo", kind: "import", line: 'import { useMemo } from "react"' },
  { name: "useEffect", kind: "import", line: 'import { useEffect } from "react"' },
  { name: "GristRowRecord", kind: "import", line: 'import type { GristRowRecord } from "grist-widget-sdk"' },
  { name: "isGristCellError", kind: "import", line: 'import { isGristCellError } from "grist-widget-sdk"' },
  { name: "React", kind: "import", line: 'import * as React from "react"' },
  { name: "ReactElement", kind: "import", line: 'import type { ReactElement } from "react"' },

  // Illustrative placeholders: stand-ins for "your own type/component" or a
  // third-party helper, not real SDK exports.
  { name: "MyRow", kind: "ambient", line: "type MyRow = Record<string, unknown>" },
  { name: "TaskRow", kind: "ambient", line: "type TaskRow = { id: number; Done: boolean }" },
  { name: "MyWidget", kind: "ambient", line: "declare function MyWidget(): ReactElement" },
  { name: "CreateRowForm", kind: "ambient", line: "declare function CreateRowForm(props: { mappings: unknown }): ReactElement" },
  { name: "YourWidget", kind: "ambient", line: "declare function YourWidget(): ReactElement" },
  { name: "App", kind: "ambient", line: "declare function App(): ReactElement" },
  { name: "RowPanel", kind: "ambient", line: "declare function RowPanel(): ReactElement" },
  { name: "DocsLink", kind: "ambient", line: "declare function DocsLink(): ReactElement" },
  { name: "ErrorBoundary", kind: "ambient", line: "declare function ErrorBoundary(props: { FallbackComponent: unknown; children?: unknown }): ReactElement" },
  { name: "MyErrorScreen", kind: "ambient", line: "declare function MyErrorScreen(): ReactElement" },
  { name: "Alert", kind: "ambient", line: "declare function Alert(props: { variant?: string; children?: unknown }): ReactElement" },
  { name: "AlertTitle", kind: "ambient", line: "declare function AlertTitle(props: { children?: unknown }): ReactElement" },
  { name: "AlertDescription", kind: "ambient", line: "declare function AlertDescription(props: { children?: unknown }): ReactElement" },
  { name: "Button", kind: "ambient", line: "declare function Button(props: { disabled?: boolean; onClick?: () => void; children?: unknown }): ReactElement" },
  { name: "Spinner", kind: "ambient", line: "declare function Spinner(): ReactElement" },
  { name: "Skeleton", kind: "ambient", line: "declare function Skeleton(): ReactElement" },
  { name: "Grid", kind: "ambient", line: "declare function Grid(props: { rows: unknown }): ReactElement" },
  { name: "useQuery", kind: "ambient", line: "declare function useQuery(opts: { queryKey: unknown[]; queryFn: () => unknown; enabled?: boolean }): { data: unknown }" },
  { name: "byPriority", kind: "ambient", line: "declare function byPriority(a: unknown, b: unknown): number" },
  { name: "id", kind: "ambient", line: "declare const id: number" },
  { name: "patch", kind: "ambient", line: "declare const patch: Record<string, unknown>" },
  { name: "toast", kind: "ambient", line: "declare const toast: { error(message: string): void }" },
  { name: "spy", kind: "ambient", line: "declare const spy: (...args: unknown[]) => void" },
]

/** True if `code` already brings `name` into scope itself (own import, or own declaration). */
function alreadyInScope(code, name) {
  const ownImport = new RegExp(`import\\s+(type\\s+)?\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from`)
  const ownDecl = new RegExp(`\\b(function|const|let|type|class)\\s+${name}\\b`)
  return ownImport.test(code) || ownDecl.test(code)
}

/** Import/ambient lines this snippet needs: referenced by name, not already supplied by the snippet itself. */
function supplyFor(code, { forceInclude = [] } = {}) {
  const wanted = new Set(forceInclude)
  for (const { name } of KNOWN_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(code)) wanted.add(name)
  }
  // One transitive pass: an ambient decl can itself reference another known
  // name (every illustrative `declare function Foo(): ReactElement` needs
  // ReactElement) -- scan the wanted lines' own text too, not just the
  // original snippet, or e.g. MyWidget without ReactElement anywhere in the
  // snippet body pulls in a decl that fails to compile on its own account.
  for (const { name, line } of KNOWN_NAMES) {
    if (wanted.has(name) && new RegExp(`\\bReactElement\\b`).test(line)) wanted.add("ReactElement")
  }
  const lines = KNOWN_NAMES.filter(({ name }) => wanted.has(name) && !alreadyInScope(code, name)).map(
    ({ line }) => line,
  )
  return lines.join("\n")
}

/** Extracts every fenced \`\`\`tsx block from one .mdx file, with its fence info string (e.g. "no-check"). */
function extractFromFile(absPath) {
  const lines = readFileSync(absPath, "utf8").split("\n")
  const blocks = []
  let capturing = null
  let info = null
  for (const line of lines) {
    const open = capturing === null ? FENCE_OPEN.exec(line) : null
    if (open) {
      capturing = []
      info = open.groups?.info ?? null
    } else if (capturing !== null && FENCE_CLOSE.test(line)) {
      blocks.push({ code: capturing.join("\n"), info })
      capturing = null
    } else if (capturing !== null) {
      capturing.push(line)
    }
  }
  return blocks
}

function walkMdxFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkMdxFiles(full))
    else if (entry.name.endsWith(".mdx")) out.push(full)
  }
  return out
}

function slugFor(mdxPath, index) {
  return (
    relative(docsDir, mdxPath)
      .replace(/\.mdx$/, "")
      .replace(/[/\\]/g, "__") + `__${index}`
  )
}

/** Wraps one extracted block as a standalone, type-checkable .tsx file's contents. */
function renderSnippetFile(code) {
  const trimmed = code.trim()
  // "export const X = ..." / "export function X() {...}" is a real top-level
  // declaration too -- wrapping it inside the fragment function below would
  // make its `export` a syntax error (only legal at module scope).
  const selfContained = trimmed.startsWith("import ") || trimmed.startsWith("export ")
  if (selfContained) {
    return `${code}\n\n${supplyFor(code)}\n`
  }
  const indented = code
    .split("\n")
    .map((l) => (l.length ? `  ${l}` : l))
    .join("\n")
  // useGrist is force-included: the wrapper's own `const w = ...` line needs
  // it for ReturnType<typeof useGrist>, even for a fragment that never
  // spells the name itself (e.g. a bare `if (!w.columnMappingStatus.ok)`).
  const supply = supplyFor(code, { forceInclude: ["useGrist"] })
  // The trailing `;` matters: without it, "ReturnType<typeof useGrist>"
  // followed on the next line by a JSX tag like "<GristWidgetProvider ...>"
  // parses as one continued comparison expression ("useGrist> < GristWidgetProvider")
  // instead of two statements -- ASI doesn't insert a semicolon here because
  // `>` immediately followed by `<` is still a grammatically valid
  // continuation. Found live via this exact generator.
  return `${supply}\n\nfunction __snippet__() {\n  const w = null as unknown as ReturnType<typeof useGrist>;\n${indented}\n}\n`
}

/**
 * Regenerates packages/core/tests/docs/.generated/ from the current docs
 * corpus. Returns the manifest (one entry per extracted snippet) so the
 * caller can attribute a tsc failure back to its source .mdx file + block
 * index.
 */
export function extractDocSnippets() {
  rmSync(generatedDir, { recursive: true, force: true })
  mkdirSync(generatedDir, { recursive: true })

  const manifest = []
  for (const mdxPath of walkMdxFiles(docsDir).sort()) {
    const blocks = extractFromFile(mdxPath)
    blocks.forEach(({ code, info }, i) => {
      if (info === "no-check") {
        manifest.push({ source: relative(repoRoot, mdxPath), blockIndex: i, skipped: "no-check" })
        return
      }
      const slug = slugFor(mdxPath, i)
      const outPath = join(generatedDir, `${slug}.tsx`)
      writeFileSync(outPath, renderSnippetFile(code))
      manifest.push({
        source: relative(repoRoot, mdxPath),
        blockIndex: i,
        generated: relative(repoRoot, outPath),
      })
    })
  }
  writeFileSync(join(generatedDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

// CLI mode, for manual inspection: `node scripts/extract-doc-snippets.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = extractDocSnippets()
  console.log(`Extracted ${manifest.length} snippets from ${walkMdxFiles(docsDir).length} .mdx files into ${relative(repoRoot, generatedDir)}/`)
}
