// Loads the examples in Node for scripts/build-widgets-manifest.mjs, the way
// a scaffolded widget would see them: `@/components/ui/*` resolves to the
// template's primitives, or to examples/_ui/ for the few only examples use
// (scripts/compose-example.mjs adds those to a composed widget), `@/lib/*`
// to the template's, and grist-widget-sdk to its source.
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const here = path.dirname(fileURLToPath(import.meta.url))
const template = path.resolve(here, "../templates/grist-widget-template-vite/src")
const core = path.resolve(here, "../packages/core/src")

export default defineConfig({
  plugins: [
    react(),
    {
      name: "examples:ui",
      enforce: "pre",
      resolveId(id) {
        const ui = /^@\/components\/ui\/(.+)$/.exec(id)
        if (!ui) return null
        const fromTemplate = path.join(template, "components/ui", `${ui[1]}.tsx`)
        return existsSync(fromTemplate) ? fromTemplate : path.join(here, "_ui", `${ui[1]}.tsx`)
      },
    },
  ],
  resolve: {
    alias: [
      { find: /^@\/(?!components\/ui\/)(.*)$/, replacement: `${template}/$1` },
      { find: /^grist-widget-sdk\/emulator\/testing$/, replacement: `${core}/emulator/testing/index.ts` },
      { find: /^grist-widget-sdk\/emulator$/, replacement: `${core}/emulator/index.ts` },
      { find: /^grist-widget-sdk\/app$/, replacement: `${core}/app/index.ts` },
      { find: /^grist-widget-sdk$/, replacement: `${core}/index.ts` },
    ],
  },
})
