#!/usr/bin/env node
// Checks that a deployed copy of the site serves the headers `_headers`
// promises (scripts/site/headers.mjs): a docs page, a widget and a
// grist-static file. Cloudflare Pages builds on its own after a push, so
// with --wait it retries until they agree or the time runs out.
//
// Usage: node scripts/site/check-headers.mjs <origin> [--wait <seconds>]
//   e.g. node scripts/site/check-headers.mjs https://gristwidgets.com --wait 900

import { headerMismatches, PROBE_PATHS } from "./headers.mjs"

const args = process.argv.slice(2)
const origin = args[0]?.replace(/\/$/, "")
if (!origin || !/^https:\/\//.test(origin)) {
  console.error("Usage: check-headers.mjs <https origin> [--wait <seconds>]")
  process.exit(2)
}
const waitAt = args.indexOf("--wait")
const deadline = Date.now() + (waitAt >= 0 ? Number(args[waitAt + 1]) : 0) * 1000

async function check() {
  const problems = []
  for (const path of PROBE_PATHS) {
    try {
      const response = await fetch(origin + path, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(20_000) })
      if (!response.ok) problems.push(`${path}: HTTP ${response.status}`)
      else problems.push(...headerMismatches(path, response.headers))
    } catch (e) {
      problems.push(`${path}: ${e.message}`)
    }
  }
  return problems
}

for (;;) {
  const problems = await check()
  if (problems.length === 0) {
    console.log(`${origin}: the headers match _headers on ${PROBE_PATHS.join(", ")}.`)
    break
  }
  if (Date.now() >= deadline) {
    for (const p of problems) console.error(`::error::${origin}${p}`)
    process.exit(1)
  }
  console.log(`${problems.length} mismatch(es), retrying in 30 s: ${problems[0]}`)
  await new Promise((r) => setTimeout(r, 30_000))
}
