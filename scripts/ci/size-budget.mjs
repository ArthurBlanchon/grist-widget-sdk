// The template's built JavaScript, gzipped, against a budget: every widget
// starts from the template, so this is the SDK's weight in every widget. It
// fails when the build grows past the budget, so a dependency or a feature
// can't add weight unnoticed (zod once added 23 KB to every widget).
//
//   node scripts/ci/size-budget.mjs <dist dir>
//
// Raising the budget is a decision: change SIZE_BUDGET_GZIP_BYTES in this
// file in the pull request that needs it, and say why.

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { gzipSync } from "node:zlib"

/** Measured at 93.7 KB after SDK 0.4.0 (no zod); about 5 % of headroom. */
export const SIZE_BUDGET_GZIP_BYTES = 100_000

export function jsGzipBytes(dir) {
  let total = 0
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith(".js")) total += gzipSync(readFileSync(p), { level: 9 }).length
    }
  }
  walk(dir)
  return total
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2]
  if (!dir) {
    console.error("Usage: node scripts/ci/size-budget.mjs <dist dir>")
    process.exit(2)
  }
  const size = jsGzipBytes(dir)
  const kb = (n) => `${(n / 1000).toFixed(1)} KB`
  console.log(`size-budget: ${kb(size)} of JavaScript (gzip), budget ${kb(SIZE_BUDGET_GZIP_BYTES)}`)
  if (size > SIZE_BUDGET_GZIP_BYTES) {
    console.error(`size-budget: over by ${kb(size - SIZE_BUDGET_GZIP_BYTES)}. Find what grew, or raise SIZE_BUDGET_GZIP_BYTES in scripts/ci/size-budget.mjs and say why.`)
    process.exit(1)
  }
}
