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
// - its code (src/, tests and demo data aside): no hard-coded colour, no pixel size and no
//   arbitrary Tailwind value, since the theme in widgets/_shared/ is the only
//   place they live (ADR 0008).
//
// With --sizes, after the widgets are built, also the licences of what each
// widget ships (dist/licenses.json, against ALLOWED_LICENCES), and its JavaScript
// (gzipped) against its budget: `bundle-kb` in its spec's front matter, or
// DEFAULT_BUNDLE_KB. A heavier budget is a choice its spec states.
//
// Usage: node scripts/widgets/check-widgets.mjs [--sizes] [slug...]

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { jsGzipBytes } from "../ci/size-budget.mjs"
import { parseCspExtra, PLUGIN_API_URL, specCsp } from "../../widgets/_shared/csp.mjs"

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

/** A widget's JavaScript budget, gzipped, unless its spec sets `bundle-kb`: the Kanban board is 98.5 KB. */
export const DEFAULT_BUNDLE_KB = 125

/** Problems with a built widget's size against its budget. */
export function checkSize(slug, spec, dir = join(WIDGETS_DIR, slug)) {
  const dist = join(dir, "dist")
  if (!existsSync(dist)) return [`dist/ is missing: build the widget before --sizes`]
  const budget = Number(spec.data["bundle-kb"] ?? DEFAULT_BUNDLE_KB)
  if (!Number.isFinite(budget) || budget <= 0) return ["SPEC.md: bundle-kb must be a positive number"]
  const kb = jsGzipBytes(dist) / 1000
  console.log(`  ${slug}: ${kb.toFixed(1)} KB of JavaScript (gzip), budget ${budget} KB`)
  return kb > budget ? [`bundle: ${kb.toFixed(1)} KB gzipped, over its ${budget} KB budget`] : []
}

/**
 * The licences a widget may ship code under (widgets/AGENTS.md): permissive
 * ones, and the Open Font License for fonts. Copyleft, weak or strong (MPL,
 * EPL, LGPL, GPL), is refused: a widget is copied into documents, sites and
 * forks without its source alongside.
 */
export const ALLOWED_LICENCES = ["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "Unlicense", "CC0-1.0", "BlueOak-1.0.0", "OFL-1.1"]

/**
 * Whether an SPDX expression allows shipping: parsed with its precedence
 * (AND binds tighter than OR, parentheses group), an OR needing one allowed
 * side and an AND both. Anything it can't parse (WITH, a stray word,
 * "Unknown") is refused.
 */
export function licenceAllowed(expression, allowed = ALLOWED_LICENCES) {
  const tokens = String(expression).match(/\(|\)|[^\s()]+/g) ?? []
  let at = 0
  const peek = () => tokens[at]
  const fail = () => {
    throw new Error("unparsable")
  }
  const primary = () => {
    const t = tokens[at++]
    if (t === "(") {
      const value = or()
      if (tokens[at++] !== ")") fail()
      return value
    }
    if (!t || t === ")" || /^(AND|OR|WITH)$/i.test(t)) fail()
    return allowed.includes(t)
  }
  const and = () => {
    let value = primary()
    while (peek() && /^AND$/i.test(peek())) {
      at++
      value = primary() && value
    }
    return value
  }
  const or = () => {
    let value = and()
    while (peek() && /^OR$/i.test(peek())) {
      at++
      value = and() || value
    }
    return value
  }
  try {
    const value = or()
    return at === tokens.length && tokens.length > 0 && value
  } catch {
    return false
  }
}

/** Problems with the licences of what a built widget ships (dist/licenses.json, from _shared/vite.ts). */
export function checkLicences(dir) {
  const file = join(dir, "dist", "licenses.json")
  if (!existsSync(file)) return ["dist/licenses.json is missing: build the widget before --sizes"]
  return JSON.parse(readFileSync(file, "utf8"))
    .filter((p) => !licenceAllowed(p.license))
    .map((p) => `licence: ${p.name}@${p.version} is ${p.license}, not on the allow list (${ALLOWED_LICENCES.join(", ")})`)
}

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

/** The standard criteria every catalog spec lists (ADR 0018), and the one a test checks in the widget. */
export const STANDARD_CRITERIA = ["AC-volume", "AC-keyboard", "AC-narrow", "AC-readonly"]

/**
 * The widgets that don't carry the standard criteria yet: every other one
 * must (ADR 0018). This list only shrinks; each widget leaves it in the
 * pull request that gives it the section and its AC-volume test.
 */
export const STANDARD_PENDING = []

/** A test named for `id`, not skipped nor left to do: `it("AC-1 …")`, `it.only(…)` but no `it.skip(…)`. */
export const namesTest = (tests, id) => new RegExp(`\\bit(?:\\.(?!skip\\b|todo\\b|fails\\b)\\w+)?\\(\\s*["'\`]${id}\\b`).test(tests)

/** The standard criteria ids (`**AC-volume**`) a spec's "Standard criteria" section lists. */
export const standardCriteria = (body) => {
  const section = /^##[ \t]+standard criteria[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/im.exec(body)?.[1]
  return section === undefined ? null : [...new Set([...section.matchAll(/\*\*(AC-[a-z]+)\*\*/g)].map((m) => m[1]))]
}

/** The acceptance criteria ids (`**AC-1**`) a spec lists, in order. */
export const criteria = (body) => [...new Set([...body.matchAll(/\*\*(AC-\d+)\*\*/g)].map((m) => m[1]))]

/** Grist's column types, as a spec's Columns table names them. */
export const GRIST_TYPES = ["Any", "Text", "Numeric", "Int", "Bool", "Date", "DateTime", "Choice", "ChoiceList", "Ref", "RefList", "Attachments"]

/**
 * A spec's Columns section: its first table, the columns the widget maps
 * (one object per row, keyed by the lower-cased header), and the rest of the
 * section as prose. A later table (record-editor's field types) is prose.
 */
export function columnsSection(body) {
  const text = /^## Columns\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(body)?.[1] ?? ""
  const lines = text.split("\n")
  const start = lines.findIndex((l) => l.trim().startsWith("|"))
  if (start === -1) return { header: [], rows: [], prose: text.trim() }
  let end = start
  while (end < lines.length && lines[end].trim().startsWith("|")) end++
  const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
  const [header = [], ...rest] = lines
    .slice(start, end)
    .filter((l) => !/^\|\s*:?-/.test(l.trim()))
    .map(cells)
  const keys = header.map((h) => h.toLowerCase())
  const rows = rest.filter((r) => r[0]).map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])))
  return { header: keys, rows, prose: [...lines.slice(0, start), ...lines.slice(end)].join("\n").trim() }
}

/**
 * One row of the Columns table: its name, the Grist types it takes ("Any"
 * when any), whether it is required, whether it maps several columns
 * ("several columns" in its Type cell), and its use.
 */
export function columnSpec(row) {
  const words = (row.type ?? "").split(/,|\bor\b/).map((t) => t.trim()).filter(Boolean)
  return {
    name: row.column,
    types: words.filter((w) => GRIST_TYPES.includes(w)),
    required: /^yes\b/i.test(row.required ?? ""),
    multiple: words.some((w) => /^several columns$/i.test(w)),
    use: row.use ?? "",
    unknown: words.filter((w) => !GRIST_TYPES.includes(w) && !/^several columns$/i.test(w)),
  }
}

/** The column names the spec's Columns table documents. */
export function specColumns(body) {
  return columnsSection(body).rows.map((r) => r.column)
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

/** A widget's source files (src/**, .ts, .tsx, .js, .jsx). */
function srcFilesOf(dir) {
  return existsSync(join(dir, "src")) ? walk(join(dir, "src"), (n) => /\.(tsx?|jsx?)$/.test(n)) : []
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
  // The Content Security Policy's additions (widgets/_shared/csp.mjs), and
  // the page's only outside script, which the policy allows: Grist's plugin API.
  const csp = parseCspExtra(specCsp(readFileSync(specPath, "utf8")))
  problems.push(...csp.problems.map((p) => `SPEC.md: ${p}`))
  const html = existsSync(join(dir, "index.html")) ? readFileSync(join(dir, "index.html"), "utf8") : ""
  for (const m of html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)) {
    if (/^(https?:)?\/\//.test(m[1]) && m[1] !== PLUGIN_API_URL) problems.push(`index.html: a script from ${m[1]}, which the policy refuses`)
  }
  // What the widget's code calls needs its csp: (ADR 0016), or it fails only in production.
  const code = srcFilesOf(dir).filter((f) => !/\.test\.[tj]sx?$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n")
  const connect = csp.extra["connect-src"] ?? []
  if (/\b(fetchAttachmentBlob|uploadAttachment|fetchWithAuth|getAttachmentUrl)\b/.test(code) && !connect.includes("grist")) {
    problems.push("SPEC.md: the code calls Grist's REST API (attachments, fetchWithAuth): csp: needs connect-src grist")
  }
  if (/@shared\/ui\/map\b/.test(code) && !connect.includes("https://*.basemaps.cartocdn.com")) {
    problems.push("SPEC.md: the code draws a map (@shared/ui/map): csp: needs connect-src https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com")
  }
  const table = columnsSection(body)
  if (table.rows.length) {
    for (const h of ["column", "type", "required", "use"]) {
      if (!table.header.includes(h)) problems.push(`SPEC.md: the Columns table has no "${h}" column`)
    }
    for (const col of table.rows.map(columnSpec)) {
      if (!col.types.length) problems.push(`SPEC.md: column ${col.name} names no Grist type (${GRIST_TYPES.join(", ")})`)
      for (const w of col.unknown) problems.push(`SPEC.md: column ${col.name}: "${w}" isn't a Grist type or "several columns"`)
    }
  }
  // pnpm new-widget's placeholders, which the catalog would publish as written.
  if (data.status !== "draft") {
    const changelog = join(dir, "CHANGELOG.md")
    for (const [file, text] of [
      ["SPEC.md", body],
      ["package.json's description", pkg.description ?? ""],
      ["CHANGELOG.md", existsSync(changelog) ? readFileSync(changelog, "utf8") : ""],

    ]) {
      // new-widget's placeholders: "TODO:", a "| TODO |" cell, a "- TODO" item.
      if (/\bTODO(?::|\s*\||\s*$)/m.test(text)) problems.push(`${file}: a TODO is left (new-widget's placeholder), and the widget isn't a draft`)
    }
    // demo.ts: new-widget's own placeholder only (demo rows may say TODO).
    const demoFile = join(dir, "src", "app", "demo.ts")
    if (existsSync(demoFile) && readFileSync(demoFile, "utf8").includes("TODO: realistic rows")) {
      problems.push("src/app/demo.ts: a TODO is left (new-widget's placeholder), and the widget isn't a draft")
    }
  }

  const srcFiles = existsSync(join(dir, "src")) ? walk(join(dir, "src"), (n) => /\.(tsx?|jsx?)$/.test(n)) : []
  const tests = srcFiles.filter((f) => /\.test\.[tj]sx?$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n")
  const ids = criteria(body)
  if (ids.length === 0) problems.push("SPEC.md: no acceptance criteria (**AC-1** …)")
  for (const id of ids) {
    if (!namesTest(tests, id)) problems.push(`${id}: no test names it (it("${id} …"))`)
  }
  // The standard criteria (ADR 0018), where the spec carries them: the four
  // listed, and AC-volume's test; the e2e check (--standard) checks the rest.
  const standard = standardCriteria(body)
  if (!standard && !STANDARD_PENDING.includes(slug)) problems.push("SPEC.md: no Standard criteria section (ADR 0018; new-widget writes it)")
  if (standard) {
    const missing = STANDARD_CRITERIA.filter((id) => !standard.includes(id))
    if (missing.length) problems.push(`SPEC.md: the Standard criteria section lacks ${missing.join(", ")}`)
    if (!namesTest(tests, "AC-volume")) problems.push('AC-volume: no test names it (it("AC-volume …"))')
    else if (!tests.includes("expectVolume(")) problems.push("AC-volume: its test doesn't call expectVolume() (@shared/testing), which holds the budget")
  }

  // Tests aside, and the demo data, whose colours are a Grist document's choices.
  for (const file of srcFiles.filter((f) => !/\.test\.[tj]sx?$/.test(f) && !/(^|\/)app\/demo\.ts$/.test(f))) {
    for (const [line, reason] of designViolations(readFileSync(file, "utf8"))) {
      problems.push(`${relative(dir, file)}:${line}: ${reason}`)
    }
  }
  problems.push(...checkChangelog(dir, pkg.version))
  return { problems, spec: { data, body, columns: specColumns(body) } }
}

/**
 * `[version, text]` for each `## <version>` entry of a widget's CHANGELOG.md,
 * in the order written. Code blocks and HTML comments are left out first, so
 * neither a `## 9.9.9` in a code sample nor a `<!-- todo -->` counts.
 */
export function changelogEntries(text) {
  const plain = `${text.replace(/```[\s\S]*?```/g, "").replace(/<!--[\s\S]*?-->/g, "")}\n`
  const out = []
  const re = /^## (\d+\.\d+\.\d+)\b[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/gm
  for (const m of plain.matchAll(re)) out.push([m[1], m[2].trim()])
  return out
}

/**
 * A widget's CHANGELOG.md has an entry for the version its package.json
 * declares, first: what changed for the people using it (plan to 0.8.0, M2).
 */
export function checkChangelog(dir, version) {
  const path = join(dir, "CHANGELOG.md")
  if (!existsSync(path)) return ["CHANGELOG.md is missing (an entry per version, newest first)"]
  const entries = changelogEntries(readFileSync(path, "utf8"))
  if (!entries.length) return ["CHANGELOG.md: no `## x.y.z` entry"]
  if (entries[0][0] !== version) return [`CHANGELOG.md: its first entry is ${entries[0][0]}, not ${version} (package.json's version)`]
  if (!entries[0][1]) return [`CHANGELOG.md: the ${version} entry says nothing`]
  return []
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
    // defineGristWidget keeps the title and description apart from the options.
    const metadata = mod.widget.metadata ?? {}
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
    return declarationProblems({ options, metadata, pkg, spec })
  } finally {
    await server.close()
  }
}

/**
 * What differs between a widget's declaration and what the catalog publishes
 * of it: the spec's access, title and Columns table, and package.json's
 * description (the catalog page's and Grist's widget list's).
 */
export function declarationProblems({ options, metadata, pkg, spec }) {
    const problems = []
    const access = options.requiredAccess ?? "read table"
    if (access !== spec.data.access) problems.push(`access: the spec says "${spec.data.access}", the declaration "${access}"`)
    if (metadata.title !== spec.data.title) {
      problems.push(`title: the spec says "${spec.data.title}", the declaration "${metadata.title}"`)
    }
    if (metadata.description !== pkg.description) {
      problems.push(`description: package.json says "${pkg.description}", the declaration "${metadata.description}"`)
    }
    const documented = new Map(columnsSection(spec.body).rows.map(columnSpec).map((c) => [c.name, c]))
    const declared = new Set()
    for (const col of options.columns ?? []) {
      const c = typeof col === "string" ? { name: col } : col
      declared.add(c.name)
      const doc = documented.get(c.name)
      if (!doc) {
        problems.push(`column ${c.name}: declared but not in the spec's Columns table`)
        continue
      }
      const types = c.type ? c.type.split(",").map((t) => t.trim()) : ["Any"]
      if ([...types].sort().join() !== [...doc.types].sort().join()) {
        problems.push(`column ${c.name}: the spec says ${doc.types.join(", ")}, the declaration ${types.join(", ")}`)
      }
      if (doc.required === Boolean(c.optional)) {
        problems.push(`column ${c.name}: the spec says ${doc.required ? "required" : "optional"}, the declaration ${c.optional ? "optional" : "required"}`)
      }
      if (doc.multiple !== Boolean(c.allowMultiple)) {
        problems.push(`column ${c.name}: the spec says ${doc.multiple ? "several columns" : "one column"}, the declaration ${c.allowMultiple ? "several (allowMultiple)" : "one"}`)
      }
    }
    for (const name of documented.keys()) {
      if (!declared.has(name)) problems.push(`column ${name}: in the spec's Columns table but not declared`)
    }
    return problems
}

async function main(argv) {
  const sizes = argv.includes("--sizes")
  const named = argv.filter((a) => !a.startsWith("--"))
  const slugs = named.length ? named : listWidgets()
  let failed = 0
  for (const slug of slugs) {
    const { problems, spec } = checkStatic(slug)
    if (spec) problems.push(...(await checkDeclaration(slug, spec)))
    if (spec && sizes) problems.push(...checkSize(slug, spec), ...checkLicences(join(WIDGETS_DIR, slug)))
    if (problems.length) {
      failed++
      console.error(`✗ ${slug}`)
      for (const p of problems) console.error(`  - ${p}`)
    } else console.log(`✓ ${slug}`)
  }
  if (failed) process.exit(1)
}

if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv.slice(2))
