#!/usr/bin/env node
// Checks every catalog widget (widgets/<slug>/, not _shared) against the rules
// of the widget factory plan that need no browser:
//
// - its package.json: private, MIT, named @grist-widgets/<slug>;
// - its SPEC.md: the front matter (slug, title, category, status, access),
//   the required sections, and acceptance criteria AC-n, each named by a
//   test (`it("AC-n …")`) in the widget's src/;
// - its declaration, imported (not parsed) through the widget's own Vite
//   config: the same title and access as the spec, every declared column in
//   the spec's Columns table;
// - its code (src/, tests aside): no hard-coded colour, no pixel size and no
//   arbitrary Tailwind value, since the theme in widgets/_shared/ is the only
//   place they live (ADR 0008).
//
// Usage: node scripts/widgets/check-widgets.mjs [slug...]

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
export const WIDGETS_DIR = join(repoRoot, "widgets")

export const CATEGORIES = [
  "visualisation",
  "data-entry",
  "documents",
  "planning",
  "maps",
  "files",
  "integrations",
  "ai",
  "data-quality",
]
export const STATUSES = ["draft", "beta", "stable", "retired"]
export const ACCESS = ["none", "read table", "full"]
export const SECTIONS = ["Job", "Columns", "Access", "Acceptance criteria", "Out of scope"]

/** The catalog widgets' slugs. */
export function listWidgets(dir = WIDGETS_DIR) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort()
}

/** `{ data, body }`: `key: value` front matter between `---` lines, and the rest. */
export function parseFrontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!m) return { data: null, body: text }
  const data = {}
  for (const line of m[1].split("\n")) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line.trim())
    if (kv) data[kv[1]] = kv[2].trim()
  }
  return { data, body: text.slice(m[0].length) }
}

/** The `## ` headings of a Markdown body. */
export const sections = (body) => [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())

/** The acceptance criteria ids (`**AC-1**`) a spec lists, in order. */
export const criteria = (body) => [...new Set([...body.matchAll(/\*\*(AC-\d+)\*\*/g)].map((m) => m[1]))]

/** The first cells of the Columns table: the column names the spec documents. */
export function specColumns(body) {
  const section = /^## Columns\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body)?.[1] ?? ""
  return section
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !/^\|\s*-/.test(l.trim()))
    .slice(1)
    .map((l) => l.split("|")[1].trim())
    .filter(Boolean)
}

const DESIGN_RULES = [
  [/#[0-9a-fA-F]{3,8}\b/, "a hard-coded colour (use a theme token)"],
  [/\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/, "a hard-coded colour (use a theme token)"],
  [/\b\d+(?:\.\d+)?px\b/, "a size in pixels (use Tailwind's scale)"],
  [/\b[\w:-]+-\[[^\]]+\]/, "an arbitrary Tailwind value (use the theme's scale)"],
]

/** `[line, reason]` for every design rule a source text breaks. */
export function designViolations(text) {
  const found = []
  text.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
    for (const [re, reason] of DESIGN_RULES) if (re.test(line)) found.push([i + 1, reason])
  })
  return found
}

function walk(dir, keep, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, keep, out)
    else if (keep(e.name)) out.push(full)
  }
  return out
}

/** Problems found without loading the widget: package, spec, criteria, design. */
export function checkStatic(slug, dir = join(WIDGETS_DIR, slug)) {
  const problems = []
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  if (pkg.name !== `@grist-widgets/${slug}`) problems.push(`package.json: name must be @grist-widgets/${slug}`)
  if (pkg.private !== true) problems.push("package.json: must be private")
  if (pkg.license !== "MIT") problems.push("package.json: license must be MIT (ADR 0007)")

  const specPath = join(dir, "SPEC.md")
  if (!existsSync(specPath)) return { problems: [...problems, "SPEC.md is missing"], spec: null }
  const { data, body } = parseFrontMatter(readFileSync(specPath, "utf8"))
  if (!data) return { problems: [...problems, "SPEC.md: no front matter"], spec: null }
  if (data.slug !== slug) problems.push(`SPEC.md: slug must be ${slug}`)
  if (!data.title) problems.push("SPEC.md: no title")
  if (!CATEGORIES.includes(data.category)) problems.push(`SPEC.md: category must be one of ${CATEGORIES.join(", ")}`)
  if (!STATUSES.includes(data.status)) problems.push(`SPEC.md: status must be one of ${STATUSES.join(", ")}`)
  if (!ACCESS.includes(data.access)) problems.push(`SPEC.md: access must be one of ${ACCESS.join(", ")}`)
  const have = sections(body)
  for (const s of SECTIONS) if (!have.includes(s)) problems.push(`SPEC.md: no "## ${s}" section`)

  const srcFiles = existsSync(join(dir, "src")) ? walk(join(dir, "src"), (n) => /\.(tsx?|jsx?)$/.test(n)) : []
  const tests = srcFiles.filter((f) => /\.test\.[tj]sx?$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n")
  const ids = criteria(body)
  if (ids.length === 0) problems.push("SPEC.md: no acceptance criteria (**AC-1** …)")
  for (const id of ids) {
    if (!new RegExp(`\\bit(?:\\.\\w+)?\\(\\s*["'\`]${id}\\b`).test(tests)) problems.push(`${id}: no test names it (it("${id} …"))`)
  }

  for (const file of srcFiles.filter((f) => !/\.test\.[tj]sx?$/.test(f))) {
    for (const [line, reason] of designViolations(readFileSync(file, "utf8"))) {
      problems.push(`${relative(dir, file)}:${line}: ${reason}`)
    }
  }
  return { problems, spec: { data, columns: specColumns(body) } }
}

/** Problems between the spec and the widget's declaration, imported through its Vite config. */
export async function checkDeclaration(slug, spec, dir = join(WIDGETS_DIR, slug)) {
  const require = createRequire(join(dir, "package.json"))
  const { createServer } = await import(require.resolve("vite"))
  const server = await createServer({
    configFile: join(dir, "vite.config.ts"),
    root: dir,
    logLevel: "error",
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  })
  try {
    const mod = await server.ssrLoadModule("/src/app/App.tsx")
    const options = mod.widget?.options
    if (!options) return ["src/app/App.tsx: no `widget` declaration (defineGristWidget)"]
    const problems = []
    const access = options.requiredAccess ?? "read table"
    if (access !== spec.data.access) problems.push(`access: the spec says "${spec.data.access}", the declaration "${access}"`)
    if (options.title && options.title !== spec.data.title) {
      problems.push(`title: the spec says "${spec.data.title}", the declaration "${options.title}"`)
    }
    for (const col of options.columns ?? []) {
      const name = typeof col === "string" ? col : col.name
      if (!spec.columns.includes(name)) problems.push(`column ${name}: declared but not in the spec's Columns table`)
    }
    return problems
  } finally {
    await server.close()
  }
}

async function main(argv) {
  const slugs = argv.length ? argv : listWidgets()
  let failed = 0
  for (const slug of slugs) {
    const { problems, spec } = checkStatic(slug)
    if (spec) problems.push(...(await checkDeclaration(slug, spec)))
    if (problems.length) {
      failed++
      console.error(`✗ ${slug}`)
      for (const p of problems) console.error(`  - ${p}`)
    } else console.log(`✓ ${slug}`)
  }
  if (failed) process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv.slice(2))
