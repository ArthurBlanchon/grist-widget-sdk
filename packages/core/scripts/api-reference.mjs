// The SDK's reference, per entry point: each public name, its kind, the first
// paragraph of its TSDoc and, for a function, its signature. api-report.mjs
// writes it from API Extractor's doc model to api/reference.json (committed,
// checked like the reports), and the docs site renders it: apps/www reads a
// committed file, so it never depends on the SDK's build.

/** The first paragraph of a TSDoc comment, on one line: no tags, no code, links as code. */
export function summaryOf(docComment) {
  if (!docComment) return ""
  const lines = docComment
    .replace(/^\s*\/\*\*/, "")
    .replace(/\*\/\s*$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\* ?/, ""))
  const paragraph = []
  for (const line of lines) {
    const text = line.trim()
    if (text.startsWith("@") || text.startsWith("```")) break
    if (!text) {
      if (paragraph.length) break
      continue
    }
    paragraph.push(text)
  }
  return paragraph
    .join(" ")
    .replace(/\{@link\s+([^}|\s]+)(?:\s*\|\s*([^}]+))?\}/g, (_, name, label) => (label ? label.trim() : `\`${name}\``))
    .replace(/\s+/g, " ")
    .trim()
}

const KINDS = {
  Function: "function",
  TypeAlias: "type",
  Interface: "type",
  Class: "class",
  Variable: "const",
  Enum: "enum",
  Namespace: "namespace",
}

/** One entry point's names, from its doc model (`<report>.api.json`), sorted. Overloads give one row. */
export function referenceOf(apiJson) {
  const entryPoint = apiJson.members?.[0]
  const byName = new Map()
  for (const member of entryPoint?.members ?? []) {
    const kind = KINDS[member.kind] ?? member.kind.toLowerCase()
    const summary = summaryOf(member.docComment)
    const signature =
      member.kind === "Function"
        ? member.excerptTokens
            .map((t) => t.text)
            .join("")
            .replace(/^declare function /, "")
            .replace(/;\s*$/, "")
            .replace(/\s+/g, " ")
        : undefined
    const seen = byName.get(member.name)
    if (seen) {
      if (!seen.summary && summary) seen.summary = summary
      if (signature) seen.signatures.push(signature)
      continue
    }
    byName.set(member.name, { name: member.name, kind, summary, signatures: signature ? [signature] : [] })
  }
  return [...byName.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(({ signatures, ...row }) => (signatures.length ? { ...row, signatures } : row))
}

/**
 * The names an entry point re-exports from another package, which the doc
 * model leaves out, from its API report: `export { screen_2 as screen }`
 * with `import { screen as screen_2 } from '@testing-library/react'`.
 */
export function reexportsOf(reportMd) {
  const from = new Map()
  for (const m of reportMd.matchAll(/^import \{ (\w+)(?: as (\w+))? \} from '([^.'][^']*)';$/gm)) from.set(m[2] ?? m[1], m[3])
  const rows = []
  for (const m of reportMd.matchAll(/^export \{ (\w+)(?: as (\w+))? \}$/gm)) {
    const pkg = from.get(m[1])
    if (pkg) rows.push({ name: m[2] ?? m[1], kind: "re-export", summary: `Re-exported from \`${pkg}\`, unchanged.` })
  }
  return rows
}
