#!/usr/bin/env node
// Builds apps/www + every examples/<id>/ (its widget at latest/, its demo at
// demo/) + grist-static + the template's own preview, and assembles them
// into ./site — the single deployable tree,
// shared by every host that serves this site.
//
// The site is published at TWO independent origins, deliberately: some
// enterprise networks allowlist github.io while blocking unknown domains,
// and some do the reverse. Neither origin redirects to the other, and each
// carries a complete copy (docs, example widgets and their demos), so the
// docs' /examples/<id>/demo/ links resolve within whichever origin the
// reader can reach.
//
//   GitHub Pages     SITE_BASE=/grist-widget-sdk/  -> arthurblanchon.github.io/grist-widget-sdk/
//   Cloudflare Pages (SITE_BASE unset)             -> gristwidgets.com
//
// Next bakes the base path into emitted hrefs AND into JS chunks, so the two
// origins genuinely need two build runs — one artifact cannot be correct at
// both a subpath and a domain root. Same source, same script, different env.
//
// SITE_BASE is the only base knob on purpose. It used to be two independent
// vars (WWW_BASE + a playground base) that had to agree; setting www's while
// serving from a domain root is what broke the first gristwidgets.com deploy
// (every asset 404'd, every link pointed off-domain). Deriving both from one
// value makes that class of mismatch unrepresentable.

import { execFileSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { demoPageHtml, GRIST_STATIC_VERSION } from "../packages/create-grist-widget/src/demo-page.mjs"
import { allExtraDependencies, composeExample, overlayExampleSrc } from "./compose-example.mjs"
import { DEMOS_DIR } from "./example-demos.mjs"
import { listExampleIds } from "./example-ids.mjs"
import { copyGristStatic } from "./site/grist-static.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Normalize to either "" (domain root) or "/prefix/" (subpath). */
function normalizeBase(raw) {
  const trimmed = (raw ?? "").trim()
  if (!trimmed || trimmed === "/") return ""
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`
}

const siteBase = normalizeBase(process.env.SITE_BASE)
// siteBase is "" at a domain root (Next's basePath rejects a bare "/") --
// but examplesBase and gristStaticBase are consumed as Vite `base` values and
// as a demo page's script URL, which need a real leading slash even at a
// domain root, or they resolve relative to the current page instead of the
// site root (found live on a Cloudflare Pages preview, PR #111).
const examplesBase = `${siteBase || "/"}examples/`
const gristStaticBase = `${siteBase || "/"}grist-static/${GRIST_STATIC_VERSION}/`
// Deliberately not "/template/" -- that was the retired showcase path (see
// templates/grist-widget-template-vite/README.md's "Live preview" section)
// that used to cause hub/channel confusion in the template itself. A
// distinctly different name keeps this preview from being mistaken for a
// resurrection of that.
const templatePreviewBase = `${siteBase || "/"}template-preview/`

// Which copy search engines should index. Both origins emit the same canonical,
// so the site is browsable from either but indexed once.
const canonicalOrigin =
  process.env.WWW_CANONICAL_ORIGIN?.trim() || "https://gristwidgets.com"

// Where THIS build is served, base path included. OG images are made absolute
// against it so a page's link preview loads from the same origin serving the
// page — otherwise github.io previews would break whenever gristwidgets.com
// did, which defeats the point of two independent origins.
const siteOrigin = (
  process.env.SITE_ORIGIN?.trim() || canonicalOrigin
).replace(/\/$/, "")
const siteUrl = `${siteOrigin}${siteBase}`.replace(/\/$/, "")

const outDir = join(repoRoot, "site")

function run(args, env) {
  console.log(`\n$ pnpm ${args.join(" ")}`)
  execFileSync("pnpm", args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
  })
}

/**
 * Compose + build every examples/<id>/ standalone, sharing one `pnpm
 * install` across all of them (see scripts/compose-example.mjs) rather than
 * one install per example — the SDK dependency is a `file:` reference to
 * packages/core (built above), the same workspace-source resolution www's
 * own build uses.
 * Proving a build against the *published* SDK is scripts/smoke/create-widget.sh's
 * job (§4 of the execution plan), not this one.
 *
 * Each example deploys at examples/<id>/latest/ — not a bare <id>/ — so the
 * composed project's own unmodified main.tsx (inherited from the template)
 * recognizes the URL as a "channel" page and renders the actual widget when
 * embedded, instead of the generic showcase hub a channel-less path falls
 * back to. See parseDeployPath() in packages/core/src/app/deploy-path.ts.
 */
function buildExamples() {
  const scratchDir = mkdtempSync(join(tmpdir(), "grist-widget-examples-"))
  const examplesOutDir = join(scratchDir, "out")
  const projectDir = join(scratchDir, "project")

  const exampleIds = listExampleIds(join(repoRoot, "examples"))

  composeExample({
    exampleId: exampleIds[0],
    destDir: projectDir,
    sdkDependency: `file:${join(repoRoot, "packages/core")}`,
  })
  const pkgPath = join(projectDir, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  Object.assign(pkg.dependencies, allExtraDependencies())
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  execFileSync("pnpm", ["install"], { cwd: projectDir, stdio: "inherit" })

  for (const id of exampleIds) {
    overlayExampleSrc({ exampleId: id, destDir: projectDir })
    execFileSync(
      "pnpm",
      [
        "exec", "vite", "build",
        "--base", `${examplesBase}${id}/latest/`,
        "--outDir", join(examplesOutDir, id, "latest"),
        "--emptyOutDir",
      ],
      { cwd: projectDir, stdio: "inherit" }
    )
    writeExampleDemo(id, join(examplesOutDir, id, "demo"))
  }

  return examplesOutDir
}

/**
 * examples/<id>/demo/: the example in a real Grist from static files
 * (grist-static, served by this site), with its committed demo document
 * (scripts/example-demos.mjs) pointed at examples/<id>/latest/.
 */
function writeExampleDemo(id, demoDir) {
  const title = widgets.find((w) => w.id === id)?.title ?? id
  mkdirSync(demoDir, { recursive: true })
  cpSync(join(DEMOS_DIR, `${id}.grist`), join(demoDir, "demo.grist"))
  writeFileSync(join(demoDir, "index.html"), demoPageHtml({ title, widget: "../latest/", gristStatic: gristStaticBase }))
}

/**
 * Builds the template's own pristine source (unmodified, no example
 * overlay) and returns the built dir. Unlike buildExamples(), no scratch
 * project or separate `pnpm install` is needed -- templates/* is already a
 * real pnpm workspace member (pnpm-workspace.yaml), already resolving
 * grist-widget-sdk from packages/core/dist the same way www does.
 *
 * Must go through `pnpm --filter grist-widget-template-vite exec ...` run
 * from repoRoot -- same as run()'s own pattern -- rather than `cd`ing into
 * the template directory and running a bare `pnpm exec` there. The template
 * carries its own nested pnpm-workspace.yaml (needed so it also works as a
 * standalone project once scaffolded externally); pnpm resolves the
 * workspace root by walking up from cwd to the *nearest*
 * pnpm-workspace.yaml, so a bare `pnpm exec` cwd'd inside the template
 * stops at that nested file instead of continuing up to the monorepo's real
 * root -- pnpm then treats the template as a one-package workspace of its
 * own, where its "grist-widget-sdk": "workspace:^" dependency can't
 * resolve. Reproduced live on Cloudflare Pages' fresh-clone build for this
 * PR (ERR_PNPM_WORKSPACE_PKG_NOT_FOUND) though not locally, where an
 * already-consistent node_modules from a prior root install papered over
 * it. `--filter` from repoRoot never has this ambiguity.
 *
 * This can only ever demonstrate the release page, the non-embedded/non-DEV
 * state -- the local-dev page only shows when main.tsx passes
 * `dev: import.meta.env.DEV` (see templates/grist-widget-template-vite/src/main.tsx),
 * which is false in every production build, this one included.
 * Seeing the local-dev page stays a `pnpm dev` (local-only) thing by design;
 * what this proves is that the release page renders correctly, and it lets a
 * reviewer paste the preview URL into a real Grist doc to see the actual
 * starter widget embedded.
 */
function buildTemplatePreview() {
  const scratchDir = mkdtempSync(join(tmpdir(), "grist-widget-template-preview-"))
  const outDir = join(scratchDir, "out")

  execFileSync(
    "pnpm",
    [
      "--filter", "grist-widget-template-vite",
      "exec", "vite", "build",
      "--base", templatePreviewBase,
      "--outDir", outDir,
    ],
    { cwd: repoRoot, stdio: "inherit" }
  )

  return outDir
}

console.log(
  `Building site\n  SITE_BASE        ${siteBase || "(domain root)"}\n` +
    `  grist-static base     ${gristStaticBase}\n` +
    `  examples base         ${examplesBase}\n` +
    `  template preview base ${templatePreviewBase}\n` +
    `  served at             ${siteUrl}\n` +
    `  canonical origin      ${canonicalOrigin}`
)

// grist-widget-sdk (every composed example depends on its build), then
// widgets.json (the examples' titles, and the demo documents' check).
run(["--filter", "grist-widget-sdk", "build"])
run(["build:widgets-manifest"])
run(["exec", "node", "scripts/example-demos.mjs", "check"])
const widgets = JSON.parse(readFileSync(join(repoRoot, "widgets.json"), "utf8"))

run(["--filter", "www", "build"], {
  // Empty means "no basePath" to next.config.mjs — which is exactly right at
  // a domain root. Passing "" rather than deleting the key keeps the intent
  // explicit in the build log.
  WWW_BASE: siteBase,
  WWW_SITE_URL: siteUrl,
  WWW_CANONICAL_ORIGIN: canonicalOrigin,
})

console.log("\nBuilding examples")
const examplesOut = buildExamples()

console.log("\nBuilding template preview")
const templatePreviewOut = buildTemplatePreview()

console.log("\nAssembling ./site")
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
console.log(`\nCopying grist-static ${GRIST_STATIC_VERSION}`)
await copyGristStatic(join(outDir, "grist-static", GRIST_STATIC_VERSION))
cpSync(examplesOut, join(outDir, "examples"), { recursive: true })
rmSync(dirname(examplesOut), { recursive: true, force: true })
cpSync(templatePreviewOut, join(outDir, "template-preview"), { recursive: true })
rmSync(dirname(templatePreviewOut), { recursive: true, force: true })

// www publishes at the site root, including its own /docs/*. Guard against its
// build ever emitting a top-level entry that would silently shadow
// examples/, grist-static/ or template-preview/.
for (const entry of readdirSync(join(repoRoot, "apps/www/out"))) {
  if (entry === "examples" || entry === "grist-static" || entry === "template-preview") {
    console.error(
      `::error::apps/www build produced a top-level '${entry}', which collides with ${entry}/. Refusing to publish.`
    )
    process.exit(1)
  }
  cpSync(join(repoRoot, "apps/www/out", entry), join(outDir, entry), {
    recursive: true,
  })
}

// GitHub Pages runs everything through Jekyll by default, which silently drops
// any top-level directory starting with `_` — including Next's own `_next/`
// static asset folder. Without this every page loads and every asset 404s.
// Harmless on hosts that don't use Jekyll, so it is written unconditionally.
writeFileSync(join(outDir, ".nojekyll"), "")

// Widgets' own demo pages (their <channel>/demo/, on github.io) load
// grist-static from gristwidgets.com, and it fetches its files (Pyodide,
// wheels, wasm): they must be readable cross-origin. GitHub Pages already
// sends this header; Cloudflare Pages reads it from _headers.
writeFileSync(join(outDir, "_headers"), "/grist-static/*\n  Access-Control-Allow-Origin: *\n")

// No CNAME is written. Setting a custom domain on a GitHub Pages site makes
// GitHub 301 that site's github.io URL to the custom domain, which would
// collapse the two origins back into one. gristwidgets.com is served by
// Cloudflare Pages instead, which owns its own domain config.

console.log(`\n✅ site/ ready (base: ${siteBase || "/"})`)
