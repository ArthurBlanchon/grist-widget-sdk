// A catalog widget's Content Security Policy (plan to 0.8.0 §3, M4): a
// <meta> the build writes into its page (_shared/vite.ts), from a strict
// base and what the widget's spec adds (its front matter's `csp:`).
//
// The base: the widget's own scripts and Grist's plugin API, nothing else
// runs; styles its own and inline (React's style attributes); images, fonts,
// media and frames its own, data: and blob: (files it fetched and shows);
// no plugin object, no base change, no form posting.
//
// A spec adds sources to some directives, e.g.
//   csp: connect-src https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com
// with several directives separated by ";". `grist` stands for the
// document's own Grist server, which no build can know (any http(s) origin).
// Scripts, eval and inline scripts can't be added.

/** Where Grist's plugin API comes from, in every widget's index.html. */
export const PLUGIN_API_ORIGIN = "https://docs.getgrist.com"

export const BASE = {
  "default-src": ["'self'"],
  "script-src": ["'self'", PLUGIN_API_ORIGIN],
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
