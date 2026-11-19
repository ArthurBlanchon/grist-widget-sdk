// Pages that left the site, and where they went. build-site.mjs writes a
// one-line page at each old path that sends the reader on: it works the
// same on both origins (GitHub Pages has no server-side redirects), and a
// target inside the site gets the origin's SITE_BASE.
//
// A retired or moved docs page adds its line here in the same pull request.

const REPO = "https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main"

/** Old path (no base, trailing slash) → new location: a site path starting with "/", or a full URL. */
/** The example widgets the site served at /examples/<id>/ until 0.8 (ADR 0023). */
const RETIRED_EXAMPLES = [
  "attachment-gallery", "bulk-mark-done", "declared-columns", "form-edit", "hello-world", "mark-done",
  "reads-demo", "rest-fetch", "schema-migration", "schema-preview", "spreadsheet-grid", "task-board",
  "theme-demo", "typed-reads", "widget-options", "writes-demo",
]

export const REDIRECTS = {
  // Maintainer docs moved into the repository (docs rewrite plan, M1).
  "/docs/contributing/": `${REPO}/AGENTS.md`,
  "/docs/contributing/deploy/": `${REPO}/docs/operations/site-deploy.md`,
  "/docs/contributing/releasing/": `${REPO}/docs/operations/releasing.md`,
  "/docs/contributing/real-widgets/": `${REPO}/docs/operations/real-widgets.md`,
  "/docs/sdk/design/principles/": `${REPO}/docs/architecture.md#design-rules`,
  "/docs/sdk/design/open-questions/": `${REPO}/docs/history/2026-11-14-sdk-open-questions.md`,
  // Merged into the Overview (docs rewrite plan, R2).
  "/docs/quickstart/introduction/": "/docs/",
  "/docs/sdk/guide/raw-plugin-api-vs-sdk/": "/docs/",
  // Merged into the guides, the reference and the examples (docs rewrite plan, R6).
  "/docs/sdk/guide/cheatsheet/": "/docs/sdk/api/",
  "/docs/sdk/guide/cookbook/": "/widgets/",
  // examples/ retired for the catalog (ADR 0023): its page, and each
  // example's widget and demo, send the reader to the catalog.
  "/docs/quickstart/examples/": "/widgets/",
  ...Object.fromEntries(
    RETIRED_EXAMPLES.flatMap((id) => [
      [`/examples/${id}/latest/`, "/widgets/"],
      [`/examples/${id}/demo/`, "/widgets/"],
    ])
  ),
}

const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

/** The target as served from an origin whose base is `siteBase` ("" or "/grist-widget-sdk/"). */
export function redirectTarget(target, siteBase) {
  if (/^https?:\/\//.test(target)) return target
  return `${siteBase.replace(/\/$/, "")}${target}`
}

/** The page written at an old path. */
export function redirectPage(target) {
  const href = escapeHtml(target)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Moved</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${href}">
<link rel="canonical" href="${href}">
</head>
<body><p>This page moved to <a href="${href}">${href}</a>.</p></body>
</html>
`
}

/** `[relative file path, html]` for every redirect, for an origin whose base is `siteBase`. */
export function redirectFiles(siteBase) {
  return Object.entries(REDIRECTS).map(([from, to]) => {
    if (!from.startsWith("/") || !from.endsWith("/")) throw new Error(`redirect source must be /…/: ${from}`)
    return [`${from.slice(1)}index.html`, redirectPage(redirectTarget(to, siteBase))]
  })
}
