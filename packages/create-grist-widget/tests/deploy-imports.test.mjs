import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// A widget's deploy workflow runs bin/grist-widget-deploy.mjs in its publish
// job, next to a `contents: write` token. The job installs with
// --ignore-scripts, so no dependency code runs during the install; this
// keeps it that way afterwards: the deploy code may only import node
// builtins and its own files, never another package.
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function importsOf(file) {
  const source = readFileSync(file, "utf8")
  const specifiers = []
  for (const match of source.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) specifiers.push(match[1])
  return specifiers
}

/** Every file the entry reaches through relative imports, with its imports. */
function importGraph(entry) {
  const graph = new Map()
  const queue = [entry]
  while (queue.length) {
    const file = queue.shift()
    if (graph.has(file)) continue
    const specifiers = importsOf(file)
    graph.set(file, specifiers)
    for (const s of specifiers) if (s.startsWith(".")) queue.push(join(dirname(file), s))
  }
  return graph
}

describe("grist-widget-deploy", () => {
  it("imports node builtins and its own files only", () => {
    const graph = importGraph(join(pkgRoot, "bin/grist-widget-deploy.mjs"))
    expect([...graph.keys()].map((f) => f.slice(pkgRoot.length + 1)).sort()).toEqual([
      "bin/grist-widget-deploy.mjs",
      "src/deploy.mjs",
      "src/protection-check.mjs",
    ])
    const external = [...graph.values()].flat().filter((s) => !s.startsWith(".") && !s.startsWith("node:"))
    expect(external).toEqual([])
  })

  it("is declared as a bin of the package", () => {
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8"))
    expect(pkg.bin["grist-widget-deploy"]).toBe("./bin/grist-widget-deploy.mjs")
  })
})
