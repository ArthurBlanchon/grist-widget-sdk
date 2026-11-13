// `upgrade`'s codemods: rewrite the grist-widget-sdk names a widget's own
// code uses that a release deprecated, and list by file and line the uses it
// can't rewrite safely (https://gristwidgets.com/docs/sdk/api/deprecated).
//
// Text rewrites, not a parser: each one is a rename or a call whose meaning
// is the same before and after, and runs only in a file that imports
// grist-widget-sdk. Anything else (a destructured flag, a call with options
// whose meaning changed) is left as it is and reported. Every rewrite is
// idempotent: a migrated file has none of the names left, so a second run
// changes nothing. The widget's typecheck is the check that follows.

import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export const DEPRECATED_URL = "https://gristwidgets.com/docs/sdk/api/deprecated"

/** The user actions that moved from the root entry to grist-widget-sdk/actions (0.6). */
export const MOVED_ACTIONS = [
  "gristAddColumnAction",
  "gristAddRecordAction",
  "gristAddTableAction",
  "gristAddVisibleColumnAction",
  "gristModifyColumnAction",
  "gristRemoveColumnAction",
  "gristRemoveRecordAction",
  "gristRenameColumnAction",
  "gristUpdateRecordAction",
]

/** What to do by hand, for a use the codemods leave in place. */
const MANUAL_HINTS = {
  isAvailable: 'read status instead: "unavailable" outside Grist, "booting" while connecting',
  isReady: 'use status === "ready"',
  fetchSelectedTable: "use fetchRows() for rows, fetchRows({ columnar: true }) for columns",
  fetchTable: "use fetchRows(tableId) for rows, fetchRows(tableId, { columnar: true }) for columns",
  fetchTableRows: "use fetchRows(tableId, options)",
  useGristContext: "use widget.useGrist() or useGrist()",
}

const PLACEHOLDER = "\u0000grist-widget-sdk/actions\u0000"
const ROOT_IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*(["'])grist-widget-sdk\3;?/g

/** `a, b as c, type T` → [{ text, name, local, type }]. */
function specifiers(list) {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const m = /^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(text)
      return m ? { text, type: !!m[1], name: m[2], local: m[3] ?? m[2] } : { text, type: false, name: null, local: null }
    })
}

function formatImport(specs, from, typeOnly, multiline) {
  const parts = specs.map((s) => s.text)
  const head = typeOnly ? "import type" : "import"
  if (multiline) return `${head} {\n${parts.map((p) => `  ${p},`).join("\n")}\n} from "${from}"`
  return `${head} { ${parts.join(", ")} } from "${from}"`
}

/** Moves the user actions to grist-widget-sdk/actions and renames useGristContext in the root import. */
function rewriteImports(text, changes) {
  const actionsImport = /import\s+\{([^}]*)\}\s*from\s*(["'])grist-widget-sdk\/actions\2;?/
  const hasActionsImport = actionsImport.test(text)
  const moved = []
  let renamedContext = false
  let out = text.replace(ROOT_IMPORT, (whole, typeOnly, list) => {
    if (typeOnly) return whole
    const keep = []
    const movedHere = []
    for (const s of specifiers(list)) {
      if (s.name && MOVED_ACTIONS.includes(s.name)) movedHere.push(s)
      else if (s.name === "useGristContext" || s.name === "useGrist") {
        if (s.name === "useGristContext") renamedContext = true
        const text = s.local === "useGristContext" || s.local === "useGrist" ? "useGrist" : `useGrist as ${s.local}`
        if (!keep.some((k) => k.text === text)) keep.push({ ...s, name: "useGrist", text })
      } else keep.push(s)
    }
    if (movedHere.length === 0 && !renamedContext) return whole
    moved.push(...movedHere)
    const multiline = whole.includes("\n")
    const root = keep.length ? formatImport(keep, "grist-widget-sdk", false, multiline) : ""
    // The first import that moves something holds the place of the one actions import.
    if (movedHere.length === 0 || hasActionsImport || moved.length > movedHere.length) return root
    return root ? `${root}\n${PLACEHOLDER}` : PLACEHOLDER
  })
  if (out.includes(PLACEHOLDER)) {
    out = out.replace(PLACEHOLDER, formatImport(moved, "grist-widget-sdk/actions", false, moved.length > 3))
  }
  if (renamedContext) changes.push("useGristContext → useGrist")
  if (moved.length === 0) return out
  changes.push(`${moved.map((s) => s.name).join(", ")}: imported from grist-widget-sdk/actions`)
  if (hasActionsImport) {
    const existing = actionsImport.exec(out)
    const current = specifiers(existing[1])
    const all = [...current, ...moved.filter((m) => !current.some((e) => e.text === m.text))]
    out = out.replace(existing[0], formatImport(all, "grist-widget-sdk/actions", false, existing[0].includes("\n")))
  }
  return out
}

/** The same name twice in one `{ … }` or `[ … ]` (two readers renamed to fetchRows): keep the first. */
function dedupe(text, name) {
  const group = new RegExp(`([{\\[])([^{}\\[\\]]*\\b${name}\\b[^{}\\[\\]]*\\b${name}\\b[^{}\\[\\]]*)([}\\]])`, "g")
  return text.replace(group, (whole, open, inner, close) => {
    const lead = /^\s*/.exec(inner)[0]
    const trail = /\s*$/.exec(inner)[0]
    const separator = /,\s*/.exec(inner)?.[0] ?? ", "
    const seen = new Set()
    const kept = inner
      .trim()
      .split(/\s*,\s*/)
      .filter((item) => item !== name || (!seen.has(item) && seen.add(item)))
    return open + lead + kept.join(separator) + trail + close
  })
}

/** One file's text, migrated: `{ text, changes, manual }` (`manual`: `{ line, name, hint }`). */
export function migrateSource(source) {
  const changes = []
  if (!/from\s*["']grist-widget-sdk["']/.test(source)) return { text: source, changes, manual: [] }
  let text = rewriteImports(source, changes)

  // Code only: a comment that names an old API keeps its wording (the author rewrites it).
  const isComment = (line) => /^\s*(\/\/|\/?\*)/.test(line)
  const rename = (pattern, replacement, change) => {
    const next = text
      .split("\n")
      .map((line) => (isComment(line) ? line : line.replace(pattern, replacement)))
      .join("\n")
    if (next !== text) {
      text = next
      if (!changes.includes(change)) changes.push(change)
    }
  }
  rename(/\buseGristContext\b/g, "useGrist", "useGristContext → useGrist")
  // `!w.isReady` / `w.isReady` on a member chain; `!!w.isReady` and destructured flags stay (reported).
  rename(/(?<![!\w$.])!([\w$]+(?:\??\.[\w$]+)*)(\??\.)isReady\b(?!\s*[=:(])/g, '$1$2status !== "ready"', 'isReady → status === "ready"')
  rename(/(?<![!\w$.])([\w$]+(?:\??\.[\w$]+)*)(\??\.)isReady\b(?!\s*[=:(])/g, '$1$2status === "ready"', 'isReady → status === "ready"')
  // The readers: the same call under fetchRows (columns kept where the old one gave columns).
  rename(/\bfetchTableRows\b/g, "fetchRows", "fetchTableRows → fetchRows")
  rename(/\bfetchSelectedTable\(\s*\)/g, "fetchRows({ columnar: true })", "fetchSelectedTable() → fetchRows({ columnar: true })")
  rename(/\bfetchTable\(([^(),]+)\)/g, "fetchRows($1, { columnar: true })", "fetchTable(id) → fetchRows(id, { columnar: true })")
  // What's left of a reader is its name (a destructured key, a dependency) once every call to it is rewritten.
  for (const old of ["fetchSelectedTable", "fetchTable"]) {
    const code = text.split("\n").filter((line) => !isComment(line)).join("\n")
    if (!new RegExp(`\\b${old}\\(`).test(code)) {
      rename(new RegExp(`\\b${old}\\b`, "g"), "fetchRows", `${old} → fetchRows`)
    }
  }
  text = dedupe(text, "fetchRows")

  const manual = []
  const lines = text.split("\n")
  lines.forEach((line, i) => {
    if (isComment(line)) return
    for (const [name, hint] of Object.entries(MANUAL_HINTS)) {
      if (new RegExp(`\\b${name}\\b`).test(line)) manual.push({ line: i + 1, name, hint })
    }
  })
  for (const name of MOVED_ACTIONS) {
    // Imported from the root entry some other way (`import * as sdk`): report it.
    if (new RegExp(`\\.${name}\\b`).test(text)) {
      const line = lines.findIndex((l) => new RegExp(`\\.${name}\\b`).test(l)) + 1
      manual.push({ line, name, hint: 'import it from "grist-widget-sdk/actions"' })
    }
  }
  return { text, changes, manual }
}

const SOURCE = /\.(tsx?|jsx?)$/
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage"])

function sources(root, dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sources(root, full))
    else if (SOURCE.test(entry.name)) out.push(path.relative(root, full).split(path.sep).join("/"))
  }
  return out
}

/**
 * Migrates every source file under `src/` but the template's own: `{ rewritten:
 * [{ file, changes }], manual: [{ file, line, name, hint }] }`.
 */
export function runCodemods(cwd, { skip = [] } = {}) {
  const rewritten = []
  const manual = []
  for (const file of sources(cwd, path.join(cwd, "src"))) {
    if (skip.includes(file)) continue
    const full = path.join(cwd, file)
    const before = readFileSync(full, "utf8")
    const result = migrateSource(before)
    if (result.text !== before) {
      writeFileSync(full, result.text)
      rewritten.push({ file, changes: result.changes })
    }
    for (const m of result.manual) manual.push({ file, ...m })
  }
  return { rewritten, manual }
}
