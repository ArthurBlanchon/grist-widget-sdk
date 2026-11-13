// `create-grist-widget manifest`: the widget's grist-widget.json, written
// into dist/ by the deploy workflow's build job, so every deployed channel
// (v<version>/, latest/, the root, dev/) serves one next to index.html.
//
// It is a Grist custom widget entry, the format of a GRIST_WIDGET_LIST_URL
// list (ICustomWidget in grist-core's app/common/CustomWidget.ts, the
// format of gristlabs/grist-widget's manifest.json), so a list of them is a
// widget list a self-hosted Grist can read. What Grist doesn't know about is
// under one key of its own, `gristWidgetSdk`. The awesome-grist-widgets
// registry and gristwidgets.com read it from a widget's install URL: they
// show what it declares without running its code.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { readWidgetExports } from "./grist-local.mjs"

export const MANIFEST_FILE = "grist-widget.json"
export const MANIFEST_SCHEMA = 1

const OWNER_REPO = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)$/
const ACCESS = new Set(["none", "read table", "full"])

/**
 * The manifest for a widget deployed under `base` (the Vite base the
 * deploy workflow built with, e.g. "/world-map/v0.1.0/" or "/world-map/dev/")
 * from `ownerRepo` ("owner/repo").
 */
export function buildManifest({ pkg, options, metadata, ownerRepo, base, sdkVersion, cliVersion, hasDemo = false, now = new Date() }) {
  const match = OWNER_REPO.exec(String(ownerRepo ?? ""))
  if (!match) throw new Error(`manifest: expected owner/repo, got ${JSON.stringify(ownerRepo)}`)
  const [, owner, repo] = match
  if (!/^\/([^/]+\/)*$/.test(String(base ?? ""))) throw new Error(`manifest: --base must be a path like /repo/v1.0.0/, got ${JSON.stringify(base)}`)
  const access = options.requiredAccess ?? "none"
  if (!ACCESS.has(access)) throw new Error(`manifest: unknown requiredAccess ${JSON.stringify(access)}`)
  const channel = /\/dev\/$/.test(base) ? "dev" : "release"
  const name = metadata?.title || pkg.name
  const url = `https://${owner.toLowerCase()}.github.io${base}`
  const description = metadata?.description || pkg.description
  return {
    name,
    widgetId: `@${owner.toLowerCase()}/${repo.toLowerCase()}`,
    url,
    // A dev build is a preview: listed, but not offered in Grist's picker.
    published: channel === "release",
    accessLevel: access,
    ...(options.columns?.length ? { columns: options.columns } : {}),
    // The SDK shows its own connecting screen until Grist is ready.
    renderAfterReady: false,
    ...(description ? { description } : {}),
    authors: [{ name: owner, url: `https://github.com/${owner}` }],
    lastUpdatedAt: now.toISOString(),
    gristWidgetSdk: {
      schema: MANIFEST_SCHEMA,
      channel,
      version: pkg.version ?? null,
      repository: `https://github.com/${owner}/${repo}`,
      license: pkg.license ?? null,
      sdk: sdkVersion ?? null,
      createGristWidget: cliVersion ?? null,
      // The widget in a real Grist, from static files (`demo --save`).
      ...(hasDemo ? { demo: `${url}demo/` } : {}),
    },
  }
}

/** The version of `name` the widget in `widgetDir` has installed, or null. */
export function installedVersion(widgetDir, name) {
  // node_modules/<name>/package.json directly: a package's "exports" may
  // not expose its package.json to require.resolve (grist-widget-sdk's doesn't).
  for (const file of [path.join(widgetDir, "node_modules", name, "package.json")]) {
    try {
      return JSON.parse(readFileSync(file, "utf8")).version ?? null
    } catch {
      // not installed there
    }
  }
  try {
    const require = createRequire(path.join(widgetDir, "package.json"))
    return JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")).version ?? null
  } catch {
    return null
  }
}

/** Reads the widget in `widgetDir` and writes `<distDir>/grist-widget.json`; returns the manifest. */
export async function writeManifest({ widgetDir, distDir, base, ownerRepo, cliVersion }) {
  if (!existsSync(path.join(distDir, "index.html"))) throw new Error(`manifest: ${distDir}/index.html is missing: build the widget first`)
  const pkg = JSON.parse(readFileSync(path.join(widgetDir, "package.json"), "utf8"))
  const { options, metadata } = await readWidgetExports(widgetDir)
  const manifest = buildManifest({
    pkg,
    options,
    metadata,
    ownerRepo,
    base,
    sdkVersion: installedVersion(widgetDir, "grist-widget-sdk"),
    cliVersion,
    hasDemo: existsSync(path.join(distDir, "demo", "index.html")),
  })
  writeFileSync(path.join(distDir, MANIFEST_FILE), JSON.stringify(manifest, null, 2) + "\n")
  return manifest
}
