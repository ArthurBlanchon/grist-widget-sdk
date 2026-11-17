#!/usr/bin/env node
// The docs pages' guardrails (docs rewrite plan §4, plan to 0.8.0 M6):
//
// - **No old forms.** A page names only the current API: not GRIST_OPTIONS,
//   WIDGET_METADATA, useGrist<…>, useGristContext, fetchSelectedTable,
//   fetchTable(, isReady, isAvailable, or a bare renderWithGrist(<…/>)
//   without its { widget, rows }. Report mode lists them; --strict fails on
//   them (CI runs it). A page that documents the old names on purpose (the
//   upgrade guide, which the CLI links) is listed in ALLOWED_PAGES, here,
//   with its reason: adding one is a change to what CI runs, so it takes
//   the maintainer's go (ADR 0012). Its old forms still print, as notices.
// - **The generated reference too.** packages/core/api/reference.json's
//   summaries render on the API reference page, so they get the same check
//   (signatures aside: `useGrist`'s own generics are its real signature).
// - **Short pages.** A page over about 800 words of prose (code aside) is
//   two pages: a warning, never a failure.
//
//   node scripts/site/docs-check.mjs [--strict]

import { appendFileSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

export const DOCS_DIR = fileURLToPath(new URL("../../apps/www/content/docs/", import.meta.url))
export const MAX_WORDS = 800
export const REFERENCE = fileURLToPath(new URL("../../packages/core/api/reference.json", import.meta.url))

/** `[name, label]` for each old form in the reference's summaries. */
export function referenceOldForms(reference) {
  const found = []
  for (const [entry, rows] of Object.entries(reference))
    for (const row of rows) for (const [re, label] of OLD_FORMS) if (re.test(row.summary)) found.push([`${entry} ${row.name}`, label])
  return found
}

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
    // Its own signature as the reference writes it, renderWithGrist(ui,
    // options?), and GristWidgetApp, which brings its own provider, are no
    // bare render. renderWithGrist(ui) or (ui, { emulator }) still is.
    if (/^\s*(ui,\s*options\?\s*\)|<GristWidgetApp\b)/.test(text.slice(m.index + m[0].length))) continue
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

/** The pages that may name old forms, by path under content/docs/, each with why. */
export const ALLOWED_PAGES = {
  "cli/upgrading.mdx":
    "it documents the names `upgrade` renames and the forms older widgets move off, and the CLI links its #renamed-sdk-names",
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
    const allowed = ALLOWED_PAGES[rel]
    for (const [line, label] of found) {
      if (!allowed) forms++
      const level = strict && !allowed ? "::error" : "::notice"
      console.log(`${level} file=apps/www/content/docs/${rel},line=${line}::old form: ${label}${allowed ? " (allowed on this page)" : ""}`)
    }
    const words = proseWords(text)
    if (words > MAX_WORDS) console.log(`::warning file=apps/www/content/docs/${rel}::${words} words: over about ${MAX_WORDS}, a page that needs more is two`)
    if (found.length || words > MAX_WORDS)
      summary.push(`| \`${rel}\` | ${found.length}${allowed ? ` (allowed: ${allowed})` : ""} | ${words}${words > MAX_WORDS ? " ⚠" : ""} |`)
  }
  for (const [name, label] of referenceOldForms(JSON.parse(readFileSync(REFERENCE, "utf8")))) {
    forms++
    console.log(`${strict ? "::error" : "::notice"} file=packages/core/api/reference.json::old form in ${name}'s TSDoc summary: ${label}`)
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
