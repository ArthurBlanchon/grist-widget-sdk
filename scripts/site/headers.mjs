// The site's `_headers` file: HTTP response headers for Cloudflare Pages
// (gristwidgets.com). GitHub Pages ignores it and sends its own defaults.
//
// Every page gets the usual hardening. The docs may only be framed by the
// site itself; what Grist (or another origin) embeds or loads is exempt:
//
// - /examples/* and /template-preview/*: widgets, added to any Grist
//   document as a custom widget URL, so any origin frames them.
// - /grist-static/*: grist-static, which widgets' own demo pages on other
//   origins load and fetch (Pyodide, wheels, wasm), hence the CORS header.
//
// Cloudflare applies every rule whose path matches; `! Name` removes a
// header an earlier rule set (https://developers.cloudflare.com/pages/configuration/headers/).

/** Hardening for every response. */
export const COMMON_HEADERS = {
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

/** For the docs only: framed by the site itself, no device access. */
export const DOCS_ONLY_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'self'",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
}

/** Paths other origins embed or load: the docs-only headers are removed there. */
export const EMBEDDABLE_PATHS = ["/examples/*", "/template-preview/*", "/grist-static/*"]

/** The `_headers` file's text. */
export function siteHeaders() {
  const block = (path, lines) => `${path}\n${lines.map((l) => `  ${l}`).join("\n")}\n`
  const set = (headers) => Object.entries(headers).map(([name, value]) => `${name}: ${value}`)
  const detach = Object.keys(DOCS_ONLY_HEADERS).map((name) => `! ${name}`)
  return [
    block("/*", [...set(COMMON_HEADERS), ...set(DOCS_ONLY_HEADERS)]),
    ...EMBEDDABLE_PATHS.map((path) =>
      block(path, path === "/grist-static/*" ? [...detach, "Access-Control-Allow-Origin: *"] : detach),
    ),
  ].join("\n")
}
