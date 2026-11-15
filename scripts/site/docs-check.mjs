#!/usr/bin/env node
// The docs pages' guardrails (docs rewrite plan §4, plan to 0.8.0 M6):
//
// - **No old forms.** A page names only the current API: not GRIST_OPTIONS,
//   WIDGET_METADATA, useGrist<…>, useGristContext, fetchSelectedTable,
//   fetchTable(, isReady, isAvailable, or a bare renderWithGrist(<…/>)
//   without its { widget, rows }. Report mode lists them; --strict fails on
//   them (once the guides are rewritten, R4).
// - **Short pages.** A page over about 800 words of prose (code aside) is
//   two pages: a warning, never a failure.
//
//   node scripts/site/docs-check.mjs [--strict]

import { appendFileSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

export const DOCS_DIR = fileURLToPath(new URL("../../apps/www/content/docs/", import.meta.url))
export const MAX_WORDS = 800

/** The old forms, each with what replaces it. */
export const OLD_FORMS = [
  [/\bGRIST_OPTIONS\b/, "GRIST_OPTIONS (use defineGristWidget)"],
  [/\bWIDGET_METADATA\b/, "WIDGET_METADATA (title and description go in defineGristWidget)"],
  [/\buseGrist</, "useGrist<…> (widget.useGrist() is typed from the declaration)"],
  [/\buseGristContext\b/, "useGristContext (removed)"],
  // The SDK's old names, not Grist's own plugin API (grist.docApi.fetchTable,
  // grist.fetchSelectedTable), which a page may show next to the SDK.
  [/(?<!docApi\.)\bfetchTable\(/, "fetchTable( (use fetchRows)"],
  [/(?<!grist\.)\bfetchSelectedTable\b/, "fetchSelectedTable (use fetchRows)"],
  [/\bisReady\b/, "isReady (removed: GristBoundary waits for Grist)"],
  [/\bisAvailable\b/, "isAvailable (removed)"],
]

/**
 * Each renderWithGrist( call whose arguments, up to its balanced closing
 * parenthesis (over several lines too), name no `widget`: `[line, label]`.
 */
export function bareRenders(text) {
  const found = []
  for (const m of text.matchAll(/\brenderWithGrist\(/g)) {
    let depth = 1
    let i = m.index + m[0].length
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === "(") depth++
      else if (text[i] === ")") depth--
    }
    if (!/\bwidget\b/.test(text.slice(m.index + m[0].length, i))) {
      found.push([text.slice(0, m.index).split("\n").length, "renderWithGrist(…) without its widget ({ widget, rows })"])
    }
  }
  return found
}

export function listPages(dir = DOCS_DIR) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...listPages(path))
    else if (name.endsWith(".mdx")) out.push(path)
  }
  return out.sort()
}

/** `[line, label]` for each old form in a page's text, by line. */
export function oldForms(text) {
  const found = []
  text.split("\n").forEach((line, i) => {
    for (const [re, label] of OLD_FORMS) if (re.test(line)) found.push([i + 1, label])
  })
  return [...found, ...bareRenders(text)].sort((a, b) => a[0] - b[0])
}

/** The words of a page's prose: front matter, code blocks, imports and tags aside. */
export function proseWords(text) {
  const prose = text
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^(import|export) .*$/gm, "")
    .replace(/<[^>]+>/g, " ")
  return prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

function main(argv) {
  const strict = argv.includes("--strict")
  let forms = 0
  const summary = []
  for (const page of listPages()) {
    const text = readFileSync(page, "utf8")
    const rel = relative(DOCS_DIR, page)
    const found = oldForms(text)
    for (const [line, label] of found) {
      forms++
      console.log(`${strict ? "::error" : "::notice"} file=apps/www/content/docs/${rel},line=${line}::old form: ${label}`)
    }
    const words = proseWords(text)
    if (words > MAX_WORDS) console.log(`::warning file=apps/www/content/docs/${rel}::${words} words: over about ${MAX_WORDS}, a page that needs more is two`)
    if (found.length || words > MAX_WORDS) summary.push(`| \`${rel}\` | ${found.length} | ${words}${words > MAX_WORDS ? " ⚠" : ""} |`)
  }
  console.log(`docs-check: ${forms} old form(s)${strict ? "" : " (report mode)"}`)
  // GitHub shows only the first annotations of a step: the summary has them all, by page.
  if (process.env.GITHUB_STEP_SUMMARY && summary.length) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Docs check\n\n| Page | Old forms | Words |\n| --- | --- | --- |\n${summary.join("\n")}\n`)
  }
  if (strict && forms) process.exitCode = 1
}

// realpath: run through a symlink, the check must still run, not pass silently.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main(process.argv.slice(2))
