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
  existsSync,
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
import { siteHeaders } from "./site/headers.mjs"
import { redirectFiles } from "./site/redirects.mjs"
import { assess, measure } from "./site/budget.mjs"
import { declaredVersions, latestVersion, RELEASE_BRANCH, releasedVersions, unreleased } from "./widgets/dist.mjs"

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

// The catalog widgets (widgets/<slug>/): their released versions, from the
// widgets-dist branch (scripts/widgets/dist.mjs), at /widgets/<slug>/<version>/,
// and the newest at /widgets/<slug>/latest/. A build of main (either origin's
// production) serves only released versions: a version main declares and the
// branch doesn't have yet is waited for, since the release job builds it on the
// same push; it is never built here. Any other build (a pull request's preview,
// a local run) builds such a version from source, so a preview shows it.
const WIDGETS_DIST_REPO = process.env.WIDGETS_DIST_REPO?.trim() || "ArthurBlanchon/grist-widget-sdk"
const isMainBuild = process.env.CF_PAGES_BRANCH
  ? process.env.CF_PAGES_BRANCH === "main"
  : process.env.GITHUB_REF === "refs/heads/main"

/** A copy of the widgets-dist branch in `dest`, or null when there is none yet. */
async function fetchReleasedWidgets(dest) {
  if (process.env.WIDGETS_DIST_DIR) return resolve(process.env.WIDGETS_DIST_DIR)
  if (process.env.WIDGETS_DIST === "none") return null
  const url = `https://codeload.github.com/${WIDGETS_DIST_REPO}/tar.gz/refs/heads/${RELEASE_BRANCH}`
  let res
  try {
    res = await fetch(url, { cache: "no-store" })
  } catch (err) {
    if (isMainBuild) throw err
    console.warn(`::warning::${url}: ${err.message}; building without released widgets`)
    return null
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  mkdirSync(dest, { recursive: true })
  const archive = `${dest}.tgz`
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()))
  execFileSync("tar", ["-xzf", archive, "--strip-components=1", "-C", dest])
  return dest
}

async function buildCatalogWidgets() {
  const scratch = mkdtempSync(join(tmpdir(), "grist-catalog-"))
  const out = join(scratch, "out")
  mkdirSync(out)
  const declared = declaredVersions(join(repoRoot, "widgets"))

  let attempt = 0
  let distDir = await fetchReleasedWidgets(join(scratch, `dist-${attempt}`))
  let missing = unreleased(declared, releasedVersions(distDir))
  // Cloudflare builds main on the same push as the release job: wait for it.
  const canWait = isMainBuild && !process.env.WIDGETS_DIST_DIR
  while (missing.length && canWait && attempt < 20) {
    console.log(`Waiting for the release of ${missing.map((m) => `${m.slug}@${m.version}`).join(", ")}`)
    await new Promise((r) => setTimeout(r, 30_000))
    attempt++
    distDir = await fetchReleasedWidgets(join(scratch, `dist-${attempt}`))
    missing = unreleased(declared, releasedVersions(distDir))
  }
  if (missing.length && isMainBuild) {
    throw new Error(
      `main declares widget versions ${RELEASE_BRANCH} doesn't have: ` +
        `${missing.map((m) => `${m.slug}@${m.version}`).join(", ")} (the release job of deploy-apps.yml builds them)`,
    )
  }

  const versions = {}
  for (const [slug, list] of Object.entries(releasedVersions(distDir))) {
    for (const v of list) cpSync(join(distDir, slug, v), join(out, slug, v), { recursive: true })
    versions[slug] = [...list]
  }
  for (const { slug, version } of missing) {
    console.log(`Building ${slug}@${version} from source (not released yet: a preview)`)
    execFileSync(
      "pnpm",
      ["--filter", `@grist-widgets/${slug}`, "exec", "vite", "build", "--outDir", join(out, slug, version), "--emptyOutDir"],
      { cwd: repoRoot, stdio: "inherit" },
    )
    versions[slug] = [...(versions[slug] ?? []), version]
  }
  for (const [slug, list] of Object.entries(versions)) {
    cpSync(join(out, slug, latestVersion(list)), join(out, slug, "latest"), { recursive: true })
  }
  // Each widget's demo page: the demo document the release job made
  // (scripts/widgets/demos.mjs), in grist-static, pointed at /latest/.
  for (const slug of Object.keys(versions)) {
    const demo = distDir && join(distDir, slug, "demo")
    if (!demo || !existsSync(join(demo, "demo.grist")) || !existsSync(join(demo, "demo.json"))) continue
    const { title } = JSON.parse(readFileSync(join(demo, "demo.json"), "utf8"))
    mkdirSync(join(out, slug, "demo"), { recursive: true })
    cpSync(join(demo, "demo.grist"), join(out, slug, "demo", "demo.grist"))
    writeFileSync(join(out, slug, "demo", "index.html"), demoPageHtml({ title, widget: "../latest/", gristStatic: gristStaticBase }))
  }
  return out
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

console.log("\nCatalog widgets")
const catalogOut = await buildCatalogWidgets()

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

// Next's /widgets/ (the docs' widget directory) was copied just above: the
// catalog's /widgets/<slug>/ folders go next to its files.
for (const slug of readdirSync(catalogOut)) {
  if (existsSync(join(outDir, "widgets", slug))) {
    console.error(`::error::widgets/${slug} collides with a page of apps/www. Refusing to publish.`)
    process.exit(1)
  }
  cpSync(join(catalogOut, slug), join(outDir, "widgets", slug), { recursive: true })
}
rmSync(dirname(catalogOut), { recursive: true, force: true })

// GitHub Pages runs everything through Jekyll by default, which silently drops
// any top-level directory starting with `_` — including Next's own `_next/`
// static asset folder. Without this every page loads and every asset 404s.
// Harmless on hosts that don't use Jekyll, so it is written unconditionally.
writeFileSync(join(outDir, ".nojekyll"), "")

// Response headers for Cloudflare Pages (GitHub Pages ignores the file):
// hardening everywhere, the docs framed only by the site itself, widgets
// embeddable by any Grist, and grist-static readable cross-origin for
// widgets' own demo pages (scripts/site/headers.mjs).
writeFileSync(join(outDir, "_headers"), siteHeaders())

// Pages that left the site: a one-line page at each old path sends the
// reader on, the same on both origins (scripts/site/redirects.mjs).
for (const [path, html] of redirectFiles(siteBase)) {
  const file = join(outDir, path)
  if (existsSync(file)) {
    console.error(`::error::redirect source ${path} is still a real page. Remove the page or the redirect.`)
    process.exit(1)
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
}

// No CNAME is written. Setting a custom domain on a GitHub Pages site makes
// GitHub 301 that site's github.io URL to the custom domain, which would
// collapse the two origins back into one. gristwidgets.com is served by
// Cloudflare Pages instead, which owns its own domain config.

// Size and file count against the hosts' limits (scripts/site/budget.mjs).
const budget = assess(measure(outDir))
for (const line of budget.lines) console.log(budget.level === "ok" ? line : `::warning::${line}`)
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs")
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Site budget\n\n${budget.lines.join("\n\n")}\n`)
}
if (budget.level === "over") process.exit(1)

console.log(`\n✅ site/ ready (base: ${siteBase || "/"})`)
