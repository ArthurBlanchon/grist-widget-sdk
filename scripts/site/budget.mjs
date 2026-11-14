// The site's size and file count against what its hosts accept (widget
// factory plan §7.3): GitHub Pages publishes a site of up to 1 GB, and
// Cloudflare Pages takes a deployment of up to 20,000 files on its free plan
// (to confirm against its current limits). The build warns at 60 % of either,
// so the retention rule or the shared runtime can be decided in time, and
// fails past 100 %, since the host would refuse the deployment anyway.

import { readdirSync, statSync } from "node:fs"
import { join } from "node:path"

export const LIMITS = { bytes: 1_000_000_000, files: 20_000 }
export const WARN_AT = 0.6

/** `{ bytes, files }` under `dir`. */
export function measure(dir) {
  let bytes = 0
  let files = 0
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else {
        bytes += statSync(p).size
        files++
      }
    }
  }
  walk(dir)
  return { bytes, files }
}

/** `{ level: "ok" | "warn" | "over", lines }` for a measure against LIMITS. */
export function assess({ bytes, files }, limits = LIMITS) {
  const share = Math.max(bytes / limits.bytes, files / limits.files)
  const level = share > 1 ? "over" : share >= WARN_AT ? "warn" : "ok"
  const pct = (n, of) => `${((100 * n) / of).toFixed(1)} %`
  const lines = [
    `site: ${(bytes / 1e6).toFixed(1)} MB (${pct(bytes, limits.bytes)} of ${limits.bytes / 1e9} GB), ` +
      `${files} files (${pct(files, limits.files)} of ${limits.files})`,
  ]
  if (level === "warn") lines.push("site: past 60 % of a host's limit: decide the retention rule or the shared runtime (plan §7.3)")
  if (level === "over") lines.push("site: over a host's limit, which would refuse the deployment")
  return { level, lines }
}
