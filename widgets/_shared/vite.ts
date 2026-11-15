/**
 * The Vite (and Vitest) configuration of every catalog widget. A widget's
 * vite.config.ts is one line:
 *
 *   export default widgetViteConfig(import.meta.dirname)
 *
 * so a build or test setting changes once, for the whole catalog.
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin, UserConfig } from "vite"

const shared = import.meta.dirname

/**
 * A package's licence, as its package.json states it (SPDX). A package that
 * states none (khroma) is read from its licence file, MIT or ISC by their
 * text; anything else is "Unknown", which the check refuses.
 */
function licenceOf(pkg: { license?: unknown; licenses?: unknown }, dir: string): string {
  if (typeof pkg.license === "string") return pkg.license
  if (pkg.license && typeof pkg.license === "object" && "type" in pkg.license) return String(pkg.license.type)
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l: { type?: string }) => l.type ?? "Unknown").join(" OR ")
  }
  for (const file of ["LICENSE", "license", "LICENSE.md", "license.md", "LICENSE.txt"]) {
    if (!existsSync(path.join(dir, file))) continue
    const text = readFileSync(path.join(dir, file), "utf8")
    if (/Permission is hereby granted, free of charge/.test(text)) return "MIT"
    if (/Permission to use, copy, modify, and\/or distribute this software for any/.test(text)) return "ISC"
  }
  return "Unknown"
}

/**
 * dist/licenses.json: every third-party package whose code the build ships,
 * with its version and licence. It is the widget's third-party notice, and
 * what `check-widgets --sizes` checks against the allow list. Only packages
 * the bundle includes count: a build tool's licence is not the widget's.
 */
export function licencesPlugin(): Plugin {
  return {
    name: "grist-widgets:licences",
    apply: "build",
    generateBundle(_options, bundle) {
      const found = new Map<string, { name: string; version: string; license: string }>()
      // The modules whose code the chunks render: what the widget ships.
      const shipped = new Set<string>()
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue
        for (const [id, info] of Object.entries(output.modules)) if (info.renderedLength > 0) shipped.add(id)
      }
      // An asset (a font from a package's CSS) names the files it came from.
      for (const output of Object.values(bundle)) {
        if (output.type === "asset") for (const file of output.originalFileNames ?? []) shipped.add(path.resolve(file))
      }
      for (const id of shipped) {
        const file = id.replace(/\\/g, "/").replace(/\?.*$/, "")
        const at = file.lastIndexOf("/node_modules/")
        if (at === -1) continue
        const rest = file.slice(at + "/node_modules/".length).split("/")
        const name = rest[0]!.startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0]!
        const manifest = path.join(file.slice(0, at), "node_modules", name, "package.json")
        if (found.has(manifest) || !existsSync(manifest)) continue
        const pkg = JSON.parse(readFileSync(manifest, "utf8"))
        found.set(manifest, { name: pkg.name ?? name, version: pkg.version ?? "", license: licenceOf(pkg, path.dirname(manifest)) })
      }
      const list = [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
      this.emitFile({ type: "asset", fileName: "licenses.json", source: `${JSON.stringify(list, null, 2)}\n` })
    },
  }
}

export function widgetViteConfig(widgetDir: string): UserConfig & { test: Record<string, unknown> } {
  return {
    // Relative URLs: a released version works at any path, on both origins.
    base: "./",
    plugins: [react(), tailwindcss(), licencesPlugin()],
    resolve: {
      alias: {
        "@shared": shared,
        // Mermaid's ELK layout engine is EPL-2.0 or GPL-3.0, off the allow
        // list: a stub that refuses, so no widget ships it (Mermaid diagram
        // locks its layout to Dagre).
        "elkjs/lib/elk.bundled.js": path.join(shared, "lib", "no-elk.ts"),
        "@": path.join(widgetDir, "src"),
      },
      // One React for the widget and the shared components.
      dedupe: ["react", "react-dom"],
    },
    test: {
      environment: "jsdom",
      root: widgetDir,
    },
  }
}
