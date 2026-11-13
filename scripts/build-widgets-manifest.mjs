#!/usr/bin/env node
// Builds widgets.json — a machine-readable catalog of every widget example
// under examples/**, so an agent (or a docs page) gets structured per-widget
// data instead of opening 17 files. Read by the CLI (its embedded examples),
// the site (example builds and demos) and the docs.
//
// "Import, do not parse": GRIST_OPTIONS and WIDGET_METADATA are read off the
// real module exports via Vite's ssrLoadModule, not regexed out of source
// text. The one exception is `usesUi` — detecting `@/components/ui/*` imports
// is deliberately a regex, because the ui dependency can live in a sibling
// file (spreadsheet-grid has several) that the entry module doesn't
// re-export anything from.
//
// examples/ is a workspace package for this: its vite.config.ts resolves the
// `@/*` alias and grist-widget-sdk -> core source, and its node_modules hold
// what the examples import.

import { createRequire } from "node:module"
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { listExampleIds } from "./example-ids.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const widgetsDir = join(repoRoot, "examples")
const outputPath = join(repoRoot, "widgets.json")

// Bump this alongside intentionally adding/removing a widget directory —
// it's a backstop against a widget silently going missing from the
// manifest, not a ceiling on how many widgets this repo may have.
const EXPECTED_WIDGET_COUNT = 16

const UI_IMPORT_RE = /@\/components\/ui\/([\w-]+)/g

const listWidgetIds = () => listExampleIds(widgetsDir)

/** Every `@/components/ui/*` import anywhere under a widget's directory, not just its entry file. */
function collectUiComponents(widgetDir) {
  const components = new Set()

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(tsx?|jsx?)$/.test(entry.name)) continue
      const text = readFileSync(full, "utf8")
      for (const match of text.matchAll(UI_IMPORT_RE)) {
        components.add(match[1])
      }
    }
  }

  walk(widgetDir)
  return [...components].sort((a, b) => a.localeCompare(b))
}

async function loadVite() {
  const require = createRequire(import.meta.url)
  const viteEntry = require.resolve("vite", { paths: [widgetsDir] })
  return import(viteEntry)
}

/**
 * Does the actual generation, unconditionally, and throws on any failure —
 * the one place that logic lives. {@link main} (CLI) and
 * {@link ensureWidgetsManifest} (importable, used by other monorepo-only
 * scripts that read widgets.json) both build on this rather than duplicating
 * it or shelling out to `node scripts/build-widgets-manifest.mjs`.
 */
export async function buildWidgetsManifest() {
  const { createServer } = await loadVite()
  const server = await createServer({
    configFile: join(widgetsDir, "vite.config.ts"),
    root: widgetsDir,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "warn",
  })

  const widgetIds = listWidgetIds()
  const entries = []
  const errors = []

  try {
    for (const id of widgetIds) {
      const widgetDir = join(widgetsDir, id)
      try {
        const mod = await server.ssrLoadModule(`/${id}/WidgetApp.tsx`)
        const declared = mod.widget && typeof mod.widget === "object" && "definition" in mod.widget ? mod.widget : null
        const gristOptions = declared?.options ?? mod.GRIST_OPTIONS ?? {}
        // WIDGET_METADATA is optional — hello-world deliberately omits it as
        // the minimal example, so falling back to the id must not be fatal.
        const metadata = (declared?.metadata?.title ? declared.metadata : null) ?? mod.WIDGET_METADATA ?? null

        entries.push({
          id,
          title: metadata?.title ?? id,
          description: metadata?.description ?? null,
          requiredAccess: gristOptions.requiredAccess ?? "none",
          columns: gristOptions.columns ?? [],
          allowSelectBy: Boolean(gristOptions.allowSelectBy),
          hasCustomOptions: Boolean(gristOptions.hasCustomOptions),
          // Not yet present anywhere (0/17 today) — the field exists so
          // consumers don't need a schema change once an example adds one.
          hasExampleDocument: "EXAMPLE_DOCUMENT" in mod,
          usesUi: collectUiComponents(widgetDir),
          sourcePath: relative(repoRoot, join(widgetDir, "WidgetApp.tsx")),
        })
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.stack : String(err)}`)
      }
    }
  } finally {
    await server.close()
  }

  if (errors.length > 0) {
    throw new Error(
      `build-widgets-manifest: failed to import widget(s):\n\n${errors.map((l) => `  - ${l}\n`).join("")}`
    )
  }

  if (entries.length !== EXPECTED_WIDGET_COUNT) {
    throw new Error(
      `build-widgets-manifest: expected ${EXPECTED_WIDGET_COUNT} widgets, found ${entries.length}. ` +
        "If a widget was intentionally added or removed, update EXPECTED_WIDGET_COUNT in this script."
    )
  }

  entries.sort((a, b) => a.id.localeCompare(b.id))
  writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`)
  console.log(
    `build-widgets-manifest: wrote ${entries.length} widgets to ${relative(repoRoot, outputPath)}`
  )
}

/**
 * Generate widgets.json only if it doesn't already exist — the fix for a
 * recurring failure mode: any script that reads widgets.json (directly, or
 * via scripts/compose-example.mjs) crashing because *some* earlier caller
 * was supposed to have run `pnpm build:widgets-manifest` first and didn't
 * (found live three times: batch G's smoke test, batch H's smoke test, and
 * the real npm release pipeline — see packages/create-grist-widget/scripts/build-template.mjs).
 * Importable by any other *monorepo-only* script (never by anything that
 * ships in a published package — widgets.json's generation needs
 * examples/'s Vite config and node_modules, neither of which exist in a
 * tarball) so the dependency is enforced at the point of need
 * instead of trusted to every caller to remember. Does not check
 * freshness/staleness — callers that need a guaranteed-current manifest
 * (the smoke tests, `pnpm typecheck:examples`) still call
 * {@link buildWidgetsManifest} directly, unconditionally.
 */
export async function ensureWidgetsManifest() {
  if (existsSync(outputPath)) return
  await buildWidgetsManifest()
}

async function main() {
  await buildWidgetsManifest()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
