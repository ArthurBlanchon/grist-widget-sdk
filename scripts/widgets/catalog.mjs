#!/usr/bin/env node
// The catalog, read from the widgets' own files (plan to 0.8.0, M2): each
// widget's SPEC.md (front matter; Job, Columns, Access, Network), its
// package.json (version, description, licence) and its CHANGELOG.md. One
// source for every list of the catalog:
//
//   node scripts/widgets/catalog.mjs --www <file>
//        the JSON the docs site's /widgets/ pages are built from (apps/www's
//        prebuild and predev)
//   node scripts/widgets/catalog.mjs --site <dir> --origin <url>
//        <dir>/catalog.json, the same list for agents and other tools; and
//        <dir>/grist-widgets.json, the list Grist's widget gallery reads
//        (GRIST_WIDGET_LIST_URL), with this origin's install URLs
//
// Drafts and retired widgets are left out. The install URL is the newest
// major's channel (ADR 0013) on gristwidgets.com, with the github.io copy as
// the alternative (ADR 0009).

import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { CATEGORIES, changelogEntries, listWidgets, parseFrontMatter, WIDGETS_DIR } from "./check-widgets.mjs"

export const ORIGINS = {
  primary: "https://gristwidgets.com",
  alternate: "https://arthurblanchon.github.io/grist-widget-sdk",
}
export const SOURCE_URL = "https://github.com/ArthurBlanchon/grist-widget-sdk/tree/main/widgets"
const LISTED = new Set(["beta", "stable"])

/** What the site calls each of check-widgets' categories. */
export const CATEGORY_LABELS = {
  visualisation: "Visualisation",
  "data-entry": "Data entry",
  documents: "Documents",
  planning: "Planning",
  maps: "Maps",
  files: "Files",
  integrations: "Integrations",
  ai: "AI",
  "data-quality": "Data quality",
}
for (const c of CATEGORIES) if (!CATEGORY_LABELS[c]) throw new Error(`catalog.mjs: no label for the category ${c}`)
const RECENT_CHANGES = 5

/** The text of a spec's `## <name>` section, or "". */
export function section(body, name) {
  const re = new RegExp(`^## ${name}[ \\t]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m")
  return re.exec(`${body}\n`)?.[1].trim() ?? ""
}

/** The rows of a spec's Columns table: name, the types it takes, required, use. */
export function columnRows(body) {
  const cells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
  const lines = section(body, "Columns")
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && !/^\|\s*:?-/.test(l.trim()))
  if (!lines.length) return []
  const header = cells(lines[0]).map((h) => h.toLowerCase())
  const at = (row, name) => row[header.indexOf(name)] ?? ""
  return lines.slice(1).map((line) => {
    const row = cells(line)
    return {
      name: row[0],
      types: at(row, "type").split(/,|\bor\b/).map((t) => t.trim()).filter(Boolean),
      required: /^yes\b/i.test(at(row, "required")),
      use: at(row, "use"),
    }
  }).filter((c) => c.name)
}

/** The newest entries of a CHANGELOG.md: version, date (when its heading has one), text. */
export function recentChanges(text, count = RECENT_CHANGES) {
  const dates = new Map(
    [...text.matchAll(/^## (\d+\.\d+\.\d+)\b[^\n]*?\((\d{4}-\d{2}-\d{2})\)/gm)].map((m) => [m[1], m[2]]),
  )
  return changelogEntries(text)
    .slice(0, count)
    .map(([version, body]) => ({ version, date: dates.get(version) ?? null, text: body }))
}

/** One widget's catalog entry, from its folder. */
export function catalogEntry(slug, dir = join(WIDGETS_DIR, slug)) {
  const { data, body } = parseFrontMatter(readFileSync(join(dir, "SPEC.md"), "utf8"))
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  const changelog = join(dir, "CHANGELOG.md")
  const columns = columnRows(body)
  const channel = `v${pkg.version.split(".")[0]}`
  const path = `/widgets/${slug}/`
  return {
    slug,
    title: data.title,
    category: data.category,
    categoryLabel: CATEGORY_LABELS[data.category] ?? data.category,
    status: data.status,
    access: data.access,
    description: pkg.description,
    license: pkg.license ?? null,
    job: section(body, "Job"),
    columns,
    // A widget that maps no columns says why, in prose.
    columnsNote: columns.length ? null : section(body, "Columns"),
    accessNote: section(body, "Access"),
    network: section(body, "Network") || null,
    version: pkg.version,
    channel,
    path,
    installUrl: `${ORIGINS.primary}${path}${channel}/`,
    alternateUrl: `${ORIGINS.alternate}${path}${channel}/`,
    source: `${SOURCE_URL}/${slug}`,
    changes: existsSync(changelog) ? recentChanges(readFileSync(changelog, "utf8")) : [],
  }
}

/** The listed widgets (beta and stable), by title. */
export function readCatalog(widgetsDir = WIDGETS_DIR) {
  return listWidgets(widgetsDir)
    .map((slug) => catalogEntry(slug, join(widgetsDir, slug)))
    .filter((w) => LISTED.has(w.status))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * The list Grist's widget gallery reads (a self-hosted Grist's
 * GRIST_WIDGET_LIST_URL), each widget at its install URL on `origin`: the
 * origin serving the list, so a copy keeps working if the other is down.
 */
export function gristWidgetList(catalog, origin) {
  const base = origin.replace(/\/$/, "")
  return catalog.map((w) => ({
    name: w.title,
    url: `${base}${w.path}${w.channel}/`,
    widgetId: `@grist-widgets/${w.slug}`,
    published: true,
    accessLevel: w.access,
    // The SDK shows its own connecting screen until Grist is ready
    // (create-grist-widget's manifest says the same).
    renderAfterReady: false,
    description: w.description,
    authors: [{ name: "grist-widget-sdk", url: `${ORIGINS.primary}/widgets/` }],
    lastUpdatedAt: w.changes[0]?.date ? `${w.changes[0].date}T00:00:00.000Z` : undefined,
    gristWidgetSdk: {
      schema: 1,
      channel: w.channel,
      version: w.version,
      repository: w.source,
      license: w.license ?? undefined,
    },
  }))
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`

/** Writes catalog.json and grist-widgets.json into `dir`, for `origin`. */
export function writeSiteCatalog(dir, origin, catalog = readCatalog()) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "catalog.json"), json(catalog))
  writeFileSync(join(dir, "grist-widgets.json"), json(gristWidgetList(catalog, origin)))
  return catalog
}

function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(name)
    return i === -1 ? null : argv[i + 1]
  }
  const www = arg("--www")
  const site = arg("--site")
  if (!www && !site) {
    console.error("Usage: catalog.mjs --www <file> | --site <dir> [--origin <url>]")
    process.exit(2)
  }
  const catalog = readCatalog()
  if (www) {
    mkdirSync(dirname(resolve(www)), { recursive: true })
    writeFileSync(www, json(catalog))
  }
  if (site) writeSiteCatalog(site, arg("--origin") ?? ORIGINS.primary, catalog)
  console.log(`catalog: ${catalog.length} widgets`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
