/**
 * The Vite (and Vitest) configuration of every catalog widget. A widget's
 * vite.config.ts is one line:
 *
 *   export default widgetViteConfig(import.meta.dirname)
 *
 * so a build or test setting changes once, for the whole catalog.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin, UserConfig } from "vite"

import { parseCspExtra, specCsp, widgetCsp } from "./csp.mjs"

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

/** The folder of package `name` as Node would find it from `fromDir`, or null. */
function packageDir(name: string, fromDir: string): string | null {
  for (let dir = fromDir; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", name)
    if (existsSync(path.join(candidate, "package.json"))) return candidate
    if (path.dirname(dir) === dir) return null
  }
}

/** A package's name from a bare specifier ("@scope/pkg/file.css" → "@scope/pkg"), or null for a path. */
function packageName(specifier: string): string | null {
  if (/^[./]|^[a-z]+:/i.test(specifier)) return null
  const parts = specifier.split("/")
  return specifier.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]!
}

/** The licence and notice files a package ships: their text, as its licence asks to keep with copies. */
function noticeText(dir: string): string {
  const files = readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f)).sort()
  return files.map((f) => readFileSync(path.join(dir, f), "utf8").trim()).join("\n\n")
}

/**
 * Two files, for every third-party package whose code the build ships:
 * - dist/licenses.json: name, version and licence (SPDX), which
 *   `check-widgets --sizes` checks against the allow list (ADR 0015);
 * - dist/THIRD-PARTY-NOTICES.txt: the same, with each package's licence and
 *   NOTICE files, the copyright notices its licence asks to keep with copies.
 *
 * Shipped means what the output holds: the modules the chunks render, the
 * assets' source files (a font), and the packages the widget's CSS
 * `@import`s (Tailwind, tw-animate-css, shadcn's CSS), which Tailwind
 * inlines. A build tool's licence is not the widget's. Not listed: the
 * workspace's own packages (grist-widget-sdk, _shared, MIT, this
 * repository's), and code a package vendors in its own files, which is
 * that package's to declare.
 */
export function licencesPlugin(): Plugin {
  return {
    name: "grist-widgets:licences",
    apply: "build",
    generateBundle(_options, bundle) {
      const dirs = new Set<string>()
      const addFile = (id: string) => {
        const file = id.replace(/\\/g, "/").replace(/\?.*$/, "")
        const at = file.lastIndexOf("/node_modules/")
        if (at === -1) return
        const name = packageName(file.slice(at + "/node_modules/".length))
        if (name) dirs.add(path.join(file.slice(0, at), "node_modules", name))
      }
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk") {
          for (const [id, info] of Object.entries(output.modules)) if (info.renderedLength > 0) addFile(id)
        } else {
          for (const file of output.originalFileNames ?? []) addFile(path.resolve(file))
        }
      }
      // The packages the widget's own CSS imports: Tailwind inlines them.
      for (const id of this.getModuleIds()) {
        const file = id.replace(/\?.*$/, "")
        if (!file.endsWith(".css") || file.includes("/node_modules/") || !existsSync(file)) continue
        for (const m of readFileSync(file, "utf8").matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) {
          const name = packageName(m[1]!)
          const dir = name && packageDir(name, path.dirname(file))
          if (dir) dirs.add(dir)
        }
      }
      const list = [...dirs]
        .filter((dir) => existsSync(path.join(dir, "package.json")))
        .map((dir) => {
          const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"))
          return { dir, name: String(pkg.name ?? path.basename(dir)), version: String(pkg.version ?? ""), license: licenceOf(pkg, dir) }
        })
        .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
      const unique = list.filter((p, i) => i === 0 || p.name !== list[i - 1]!.name || p.version !== list[i - 1]!.version)
      this.emitFile({
        type: "asset",
        fileName: "licenses.json",
        source: `${JSON.stringify(unique.map(({ name, version, license }) => ({ name, version, license })), null, 2)}\n`,
      })
      const notices = unique.map(({ dir, name, version, license }) => {
        const text = noticeText(dir)
        return `${name}@${version} (${license})\n\n${text || `No licence file in the package; its package.json says ${license}.`}`
      })
      this.emitFile({
        type: "asset",
        fileName: "THIRD-PARTY-NOTICES.txt",
        source: `Third-party software in this widget, with the licence and notice files each ships.\n\n${notices.join(`\n\n${"-".repeat(72)}\n\n`)}\n`,
      })
    },
  }
}

/**
 * The widget's Content Security Policy, as a <meta> at the top of its built
 * page (_shared/csp.mjs): the strict base, with what its SPEC.md's `csp:`
 * front matter adds. Builds only: the dev server injects inline scripts.
 */
export function cspPlugin(widgetDir: string): Plugin {
  return {
    name: "grist-widgets:csp",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const spec = path.join(widgetDir, "SPEC.md")
        const { extra, problems } = parseCspExtra(existsSync(spec) ? specCsp(readFileSync(spec, "utf8")) : "")
        if (problems.length) throw new Error(`${spec}: ${problems.join("; ")}`)
        const meta = `<meta http-equiv="Content-Security-Policy" content="${widgetCsp(extra).replace(/"/g, "&quot;")}" />`
        // Right after <meta charset>, which must stay early; before every script.
        const charset = /<meta charset="[^"]*"\s*\/?>/i
        if (!charset.test(html)) throw new Error(`${widgetDir}/index.html: no <meta charset> to put the policy after`)
        return html.replace(charset, (m) => `${m}\n    ${meta}`)
      },
    },
  }
}

export function widgetViteConfig(widgetDir: string): UserConfig & { test: Record<string, unknown> } {
  return {
    // Relative URLs: a released version works at any path, on both origins.
    base: "./",
    plugins: [react(), tailwindcss(), licencesPlugin(), cspPlugin(widgetDir)],
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
