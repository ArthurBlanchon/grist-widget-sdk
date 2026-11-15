#!/usr/bin/env node
// node scripts/widgets/demos.mjs <widgets-dist checkout>
//
// Each catalog widget's demo document, <checkout>/<slug>/demo/demo.grist:
// the widget in a real Grist, with a table built from its declared columns
// and sample rows, as `create-grist-widget demo --save` makes for a widget
// repository. It is generated in a Grist started in Docker, so the release
// job makes it (Cloudflare's build has no Docker), once per widget rather
// than per version, and again only when the widget's title, access or
// columns change (demo.json keeps a hash of them). The site serves it at
// /widgets/<slug>/demo/ (scripts/build-site.mjs). Prints the slugs it
// (re)generated.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { DEMO_URL_PLACEHOLDER } from "../../packages/create-grist-widget/src/demo-page.mjs"
import { listWidgets, WIDGETS_DIR } from "./check-widgets.mjs"

/** What a demo document is generated from: the declaration's title, access and columns, and its demo data. */
export function demoHash({ title, options, demo = null }) {
  const input = { title, requiredAccess: options.requiredAccess ?? "read table", columns: options.columns ?? [], placeholder: DEMO_URL_PLACEHOLDER, ...(demo ? { demo } : {}) }
  return createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16)
}

/** The demo.json a checkout has for `slug`, or null. */
export function storedDemo(distDir, slug) {
  const file = join(distDir, slug, "demo", "demo.json")
  return existsSync(file) && existsSync(join(distDir, slug, "demo", "demo.grist")) ? JSON.parse(readFileSync(file, "utf8")) : null
}

/** The widgets whose demo is missing or was generated from another declaration. */
export const demosToMake = (declared, distDir) =>
  declared.filter((w) => storedDemo(distDir, w.slug)?.hash !== demoHash(w))

async function main() {
  const distDir = process.argv[2] && resolve(process.argv[2])
  if (!distDir) {
    console.error("Usage: node scripts/widgets/demos.mjs <widgets-dist checkout>")
    process.exit(2)
  }
  const { readWidgetExports } = await import("../../packages/create-grist-widget/src/grist-local.mjs")
  const declared = []
  for (const slug of listWidgets()) {
    const { options, metadata, demo } = await readWidgetExports(join(WIDGETS_DIR, slug))
    declared.push({ slug, title: metadata?.title || options.title || slug, options, demo })
  }
  const todo = demosToMake(declared, distDir)
  if (todo.length === 0) return
  const { createDemoDocument, withLocalGrist } = await import("../../packages/create-grist-widget/src/demo.mjs")
  await withLocalGrist(
    async (grist) => {
      for (const w of todo) {
        const dir = join(distDir, w.slug, "demo")
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, "demo.grist"), await createDemoDocument({ ...grist, options: w.options, name: w.title, demo: w.demo }))
        writeFileSync(join(dir, "demo.json"), `${JSON.stringify({ hash: demoHash(w), title: w.title }, null, 2)}\n`)
        console.log(w.slug)
      }
    },
    { gristPort: 8694, container: "grist-widget-catalog-demos", log: (m) => console.error(m) },
  )
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
