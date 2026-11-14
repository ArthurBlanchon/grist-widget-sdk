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

import { GRIST_STATIC_VERSION } from "../../packages/create-grist-widget/src/demo-page.mjs"

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

/**
 * The headers Cloudflare sends for `url` under `file` (a `_headers` text):
 * every rule whose path matches applies in order, and `! Name` removes a
 * header an earlier rule set. A Map of lower-cased name to value.
 */
export function headersFor(file, url) {
  const rules = []
  for (const line of file.split("\n")) {
    if (!line.trim()) continue
    if (!line.startsWith(" ")) rules.push({ path: line.trim(), lines: [] })
    else rules.at(-1).lines.push(line.trim())
  }
  const matches = (rulePath) => {
    const re = new RegExp(`^${rulePath.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`)
    return re.test(url)
  }
  const out = new Map()
  for (const rule of rules.filter((r) => matches(r.path))) {
    for (const line of rule.lines) {
      if (line.startsWith("! ")) out.delete(line.slice(2).toLowerCase())
      else {
        const i = line.indexOf(":")
        out.set(line.slice(0, i).toLowerCase(), line.slice(i + 1).trim())
      }
    }
  }
  return out
}

/** The paths the live check probes: a docs page, a widget, a grist-static file. */
export const PROBE_PATHS = ["/docs/", "/examples/hello-world/latest/", `/grist-static/${GRIST_STATIC_VERSION}/app.html`]

/**
 * What differs between the headers `_headers` promises for `path` and the
 * `actual` ones (a Headers object or Map): one line per mismatch, empty when
 * they agree. Only the headers the file names are compared.
 */
export function headerMismatches(path, actual, file = siteHeaders()) {
  const get = (name) => (typeof actual.get === "function" ? actual.get(name) : undefined) ?? null
  const expected = headersFor(file, path)
  const named = new Set(
    file
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("/"))
      .map((l) => (l.startsWith("! ") ? l.slice(2) : l.slice(0, l.indexOf(":"))).toLowerCase())
  )
  const problems = []
  for (const name of named) {
    const want = expected.get(name) ?? null
    const got = get(name)
    if (want !== got) problems.push(`${path}: ${name} is ${got === null ? "absent" : JSON.stringify(got)}, expected ${want === null ? "absent" : JSON.stringify(want)}`)
  }
  return problems
}
