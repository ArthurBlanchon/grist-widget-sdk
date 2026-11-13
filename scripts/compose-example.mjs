#!/usr/bin/env node
// Composes one example (examples/<id>/) into a full, buildable project by
// overlaying it onto the template — the same "copy a source dir, do fixed
// edits" pattern packages/create-grist-widget/scripts/build-template.mjs
// already uses to embed the template itself.
//
// The logic itself lives in createComposer({ templateDir, examplesDir,
// uiDir, manifestPath }), parameterized rather than hardcoded to this
// monorepo's own layout, because it now runs with TWO different path
// bindings:
//
//   - monorepo-rooted (this file's own bottom section, exported under the
//     names below) — scripts/build-site.mjs -> temp dir -> site/examples/<id>/,
//     and scripts/smoke/create-widget.sh -> temp dir -> built against a
//     packed SDK tarball.
//   - package-rooted — packages/create-grist-widget/scripts/build-template.mjs
//     copies this file verbatim into packages/create-grist-widget/vendor/
//     (safe, since it now has no hardcoded paths left), and the CLI's own
//     bin/create-grist-widget.mjs imports createComposer from there to bind
//     it against the *published* package's own embedded template/examples/
//     manifest — see batch H, docs/history/2026-08-08-execution-plan.md §98-105.
//
// See docs/history/2026-08-08-execution-plan.md §3 ("Composition is the same
// function as `use`") and batch G.
//
// Dependency-free (node builtins only), matching every other scripts/*.mjs
// in this repo.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

// The one example needing an npm dependency beyond what copying a missing
// `@/components/ui/*` file covers — spreadsheet-grid's grid rendering pulls
// in this package directly, not just through a ui primitive. Pinned to
// examples/package.json's version, the only other consumer. Example-id-keyed
// data, not a path — identical regardless of which composer binding uses it.
const EXTRA_DEPENDENCIES = {
  "spreadsheet-grid": { "react-datasheet-grid": "^4.11.6" },
}

const TEMPLATE_SKIP = new Set(["node_modules", "dist", ".turbo"])

/** Union of every example's extra npm deps — see EXTRA_DEPENDENCIES above. */
export function allExtraDependencies() {
  return Object.assign({}, ...Object.values(EXTRA_DEPENDENCIES))
}

/**
 * Build a { composeExample, overlayExampleSrc, allExtraDependencies,
 * mergeExtraDependencies } bound to one set of source directories. Two
 * bindings exist today — see the file header comment.
 */
export function createComposer({ templateDir, examplesDir, uiDir, manifestPath }) {
  function loadManifestEntry(exampleId) {
    if (!existsSync(manifestPath)) {
      throw new Error(
        `${basename(manifestPath)} not found — run \`pnpm build:widgets-manifest\` first (needed for usesUi).`
      )
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    const entry = manifest.find((e) => e.id === exampleId)
    if (!entry) {
      throw new Error(`No ${basename(manifestPath)} entry for "${exampleId}" — is examples/${exampleId}/ real?`)
    }
    return entry
  }

  /**
   * Overlay `examples/<exampleId>/` onto an *already-composed* project at
   * `destDir` — everything except the template copy and `package.json` (so a
   * caller can `pnpm install` once against a project whose `package.json`
   * already lists every example's dependencies via {@link allExtraDependencies},
   * then call this repeatedly and rebuild, never reinstalling). Used directly
   * by {@link composeExample}; exported for callers doing that install-once
   * optimization themselves (scripts/build-site.mjs,
   * scripts/smoke/create-widget.sh), and by the CLI's `use <id>` (which calls
   * this directly against an already-scaffolded project, never composeExample —
   * see bin/create-grist-widget.mjs).
   */
  function overlayExampleSrc({ exampleId, destDir }) {
    const exampleDir = join(examplesDir, exampleId)
    if (!existsSync(join(exampleDir, "WidgetApp.tsx"))) {
      throw new Error(`examples/${exampleId}/WidgetApp.tsx not found`)
    }
    const manifestEntry = loadManifestEntry(exampleId)
    const srcDir = join(destDir, "src")
    const appDir = join(srcDir, "app")

    // src/app/ is the widget's own folder (see the template's AGENTS.md), so
    // the example replaces it whole: nothing from the previous widget lingers,
    // its test included, which would assert against content no longer there.
    // The template's files around it (main.tsx, components/ui, lib,
    // index.css) stay as they are.
    rmSync(appDir, { recursive: true, force: true })
    mkdirSync(appDir, { recursive: true })

    // The template's smoke test comes back with any example: it only reads
    // GRIST_OPTIONS, so a widget started from an example is smoke-tested too.
    const smokeTest = join(templateDir, "src/app/App.smoke.test.tsx")
    if (existsSync(smokeTest)) cpSync(smokeTest, join(appDir, "App.smoke.test.tsx"))

    // The host contract's only mismatch: examples export `WidgetApp` (no
    // default export), the template's main.tsx does a default-only import.
    // A copy-time transform, not a rewrite of the source file on disk (which
    // stays untouched under examples/) — same idiom as deploy.mjs's
    // identityEdits.
    const widgetAppSrc = readFileSync(join(exampleDir, "WidgetApp.tsx"), "utf8")
    writeFileSync(join(appDir, "App.tsx"), `${widgetAppSrc}\nexport default WidgetApp\n`)

    const testPath = join(exampleDir, "WidgetApp.test.tsx")
    if (existsSync(testPath)) {
      writeFileSync(join(appDir, "App.test.tsx"), readFileSync(testPath, "utf8"))
    }

    // Every other file living alongside WidgetApp.tsx (e.g. spreadsheet-grid's 5
    // sibling components) travels with it, verbatim.
    for (const entry of readdirSync(exampleDir, { withFileTypes: true })) {
      if (entry.name === "WidgetApp.tsx" || entry.name === "WidgetApp.test.tsx") continue
      cpSync(join(exampleDir, entry.name), join(appDir, entry.name), { recursive: true })
    }

    // `@/components/ui/*` the template doesn't already vendor (per the
    // manifest's usesUi, computed from the real imports — see
    // scripts/build-widgets-manifest.mjs). components.json is identical
    // across the template and examples/ (verified, §4 of the plan),
    // so a straight copy is style-safe. Never removed by the cleanup above
    // (ui files from an unrelated earlier example are inert, harmless
    // leftovers — re-added here idempotently either way).
    const destUiDir = join(srcDir, "components/ui")
    for (const uiName of manifestEntry.usesUi) {
      const uiSrcPath = join(uiDir, `${uiName}.tsx`)
      if (!existsSync(uiSrcPath) || existsSync(join(destUiDir, `${uiName}.tsx`))) continue
      cpSync(uiSrcPath, join(destUiDir, `${uiName}.tsx`))
      const cssPath = join(uiDir, `${uiName}.css`)
      if (existsSync(cssPath)) cpSync(cssPath, join(destUiDir, `${uiName}.css`))
    }

    return { destDir, exampleId }
  }

  /**
   * Additively merge `exampleId`'s extra npm dependencies (see
   * EXTRA_DEPENDENCIES) into an already-composed project's package.json —
   * never touches `name` or the `grist-widget-sdk` dependency spec. Split
   * out from {@link composeExample} (which does this as part of one
   * from-scratch package.json rewrite) for `use <id>`, which overlays onto
   * an *existing* project and must only ever add, never rewrite identity.
   */
  function mergeExtraDependencies({ exampleId, destDir }) {
    const extra = EXTRA_DEPENDENCIES[exampleId]
    if (!extra || Object.keys(extra).length === 0) return { merged: false }
    const pkgPath = join(destDir, "package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    pkg.dependencies = pkg.dependencies || {}
    Object.assign(pkg.dependencies, extra)
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    return { merged: true, added: extra }
  }

  /**
   * Compose `examples/<exampleId>/` onto a fresh copy of the template at
   * `destDir`, one-shot (copies the template, overlays, and rewrites
   * `package.json` in one call). `sdkDependency` replaces the template's own
   * `workspace:^` (meaningless outside the pnpm workspace) — a `file:`
   * reference to either `packages/core` (workspace source, already built), a
   * packed tarball, or (for the CLI's `create`) a real published semver range.
   * `cliDependency` does the same for the template's `create-grist-widget`
   * devDependency (its deploy bin); without one, the devDependency is dropped,
   * since a composed example is only typechecked, built and tested here.
   *
   * For composing *many* examples against one shared `pnpm install`, use
   * {@link overlayExampleSrc} directly instead (see its own doc comment).
   */
  function composeExample({ exampleId, destDir, sdkDependency, cliDependency }) {
    rmSync(destDir, { recursive: true, force: true })
    cpSync(templateDir, destDir, {
      recursive: true,
      filter: (src) => !TEMPLATE_SKIP.has(basename(src)),
    })

    overlayExampleSrc({ exampleId, destDir })

    const pkgPath = join(destDir, "package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    pkg.name = exampleId
    pkg.dependencies["grist-widget-sdk"] = sdkDependency
    if (cliDependency) pkg.devDependencies["create-grist-widget"] = cliDependency
    else delete pkg.devDependencies["create-grist-widget"]
    Object.assign(pkg.dependencies, EXTRA_DEPENDENCIES[exampleId] ?? {})
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

    return { destDir, exampleId }
  }

  return { composeExample, overlayExampleSrc, allExtraDependencies, mergeExtraDependencies }
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const monorepo = createComposer({
  templateDir: join(repoRoot, "templates/grist-widget-template-vite"),
  examplesDir: join(repoRoot, "examples"),
  uiDir: join(repoRoot, "examples/_ui"),
  manifestPath: join(repoRoot, "widgets.json"),
})

// Re-exported under the names every existing call site already imports —
// scripts/build-site.mjs and scripts/smoke/create-widget.sh need zero
// changes for this refactor.
export const { composeExample, overlayExampleSrc, mergeExtraDependencies } = monorepo

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("--")) out[key] = true
      else {
        out[key] = next
        i++
      }
    } else out._.push(a)
  }
  return out
}

function main() {
  const [exampleId, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)
  if (!exampleId || !args.dest || !args["sdk-dependency"]) {
    console.error(
      "Usage: node scripts/compose-example.mjs <id> --dest <dir> --sdk-dependency <spec>"
    )
    process.exit(2)
  }
  const res = composeExample({
    exampleId,
    destDir: resolve(args.dest),
    sdkDependency: args["sdk-dependency"],
  })
  console.log(`composed: ${JSON.stringify(res)}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
