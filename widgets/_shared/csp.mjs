// A catalog widget's Content Security Policy (plan to 0.8.0 §3, M4): a
// <meta> the build writes into its page (_shared/vite.ts), from a strict
// base and what the widget's spec adds (its front matter's `csp:`).
//
// The base: scripts from the widget's own files only, Grist's plugin API
// included: each build ships its own copy of it (_shared/plugin-api.mjs),
// not docs.getgrist.com's, which Grist may redeploy at any time (it once
// served a development build that runs on eval, which this policy refuses);
// styles its own and inline (React's style attributes); images, fonts,
// media and frames its own, data: and blob: (files it fetched and shows);
// no plugin object, no base change, no form posting.
//
// A spec adds sources to some directives, e.g.
//   csp: connect-src https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com
// with several directives separated by ";". `grist` stands for the
// document's own Grist server, which no build can know: it allows every
// http(s) origin, and is connect-src's only wildcard (bare https: and http:
// are refused there). Scripts, eval and inline scripts can't be added.
// ADR 0016.

/** Grist's plugin API as a widget's source page loads it, for `pnpm dev`; a build replaces it (_shared/plugin-api.mjs). */
export const PLUGIN_API_URL = "https://docs.getgrist.com/grist-plugin-api.js"

export const BASE = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:"],
  "font-src": ["'self'", "data:"],
  "media-src": ["'self'", "blob:"],
  "connect-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
  "frame-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'none'"],
}

/** The directives a spec may add to. */
export const EXTENDABLE = ["connect-src", "img-src", "font-src", "media-src", "frame-src", "style-src", "object-src"]

const SOURCE = /^(https:\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?|https:|http:|data:|blob:|grist)$/

/** A spec's `csp:` value as `{ directive: [sources] }`, or problems. */
export function parseCspExtra(value) {
  const extra = {}
  const problems = []
  for (const part of String(value ?? "").split(";").map((p) => p.trim()).filter(Boolean)) {
    const [directive, ...sources] = part.split(/\s+/)
    if (!EXTENDABLE.includes(directive)) {
      problems.push(`csp: ${directive} can't be extended (only ${EXTENDABLE.join(", ")})`)
      continue
    }
    for (const s of sources) {
      if (!SOURCE.test(s)) problems.push(`csp: ${directive} ${s} isn't an https host, a scheme or grist`)
      else if (directive === "connect-src" && (s === "https:" || s === "http:")) {
        problems.push(`csp: connect-src ${s} would let the widget send data anywhere: name the hosts, or grist`)
      }
    }
    if (!sources.length) problems.push(`csp: ${directive} adds nothing`)
    extra[directive] = [...(extra[directive] ?? []), ...sources]
  }
  return { extra, problems }
}

/** The policy's text: the base with the spec's additions (`grist` → any http(s) origin). */
export function widgetCsp(extra = {}) {
  const policy = Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, [...v]]))
  for (const [directive, sources] of Object.entries(extra)) {
    const list = policy[directive]
    if (directive === "object-src") list.splice(0, list.length)
    for (const s of sources.flatMap((x) => (x === "grist" ? ["https:", "http:"] : [x]))) if (!list.includes(s)) list.push(s)
  }
  return Object.entries(policy)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ")
}

/** A spec's `csp:` front matter value, or "" (the same reading check-widgets makes). */
export function specCsp(specText) {
  const front = /^---\n([\s\S]*?)\n---/.exec(String(specText))?.[1] ?? ""
  for (const line of front.split("\n")) {
    const kv = /^([\w-]+):[ \t]*(.*)$/.exec(line.trim())
    if (kv && kv[1] === "csp") return kv[2].trim()
  }
  return ""
}
