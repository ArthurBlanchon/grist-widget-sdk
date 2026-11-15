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
//        (GRIST_WIDGET_LIST_URL), with this origin's install URLs, one entry
//        per major (ADR 0014). The site build passes the released majors.
//
// Drafts and retired widgets are left out. The install URL is the newest
// major's channel (ADR 0013) on gristwidgets.com, with the github.io copy as
// the alternative (ADR 0009).

import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { CATEGORIES, changelogEntries, columnSpec, columnsSection, listWidgets, parseFrontMatter, WIDGETS_DIR } from "./check-widgets.mjs"

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

/** The columns a spec's Columns table documents (check-widgets' reading of it). */
export function columnRows(body) {
  return columnsSection(body).rows.map(columnSpec).map(({ unknown: _, ...c }) => c)
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
  const columnsProse = columnsSection(body).prose
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
    // What the section says besides its table: how the columns work together,
    // or why a widget maps none.
    columnsNote: columnsProse || null,
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

/** Every widget's entry, drafts and retired ones included, by title. */
export function readWidgets(widgetsDir = WIDGETS_DIR) {
  return listWidgets(widgetsDir)
    .map((slug) => catalogEntry(slug, join(widgetsDir, slug)))
    .sort((a, b) => a.title.localeCompare(b.title))
}

/** The listed widgets (beta and stable): the catalog. */
export function readCatalog(widgetsDir = WIDGETS_DIR) {
  return readWidgets(widgetsDir).filter((w) => LISTED.has(w.status))
}

/** The id of a widget's major channel in Grist's widget list (ADR 0014). */
export const gristWidgetId = (slug, channel) => `@grist-widgets/${slug}/${channel}`

/**
 * The list Grist's widget gallery reads (a self-hosted Grist's
 * GRIST_WIDGET_LIST_URL), at the install URLs of `origin`: the origin serving
 * the list, so each copy works if the other is down.
 *
 * Grist keeps a gallery widget's `widgetId` in the document and looks its URL
 * up in this list each time it loads (grist-core's WidgetFrame), so an id is
 * a major channel, never a widget: `@grist-widgets/<slug>/v<major>`
 * (ADR 0014). Every released major stays in the list for the documents that
 * use it; only the newest major of a listed widget is `published` (offered
 * in the gallery). `channels` is each widget's released majors, oldest first
 * (from the release branch); a widget missing from it is listed on its
 * declared major.
 */
export function gristWidgetList(widgets, origin, channels = {}) {
  const base = origin.replace(/\/$/, "")
  return widgets.flatMap((w) => {
    const majors = channels[w.slug] ?? (LISTED.has(w.status) ? [w.channel] : [])
    return majors.map((channel) => ({
      name: w.title,
      url: `${base}${w.path}${channel}/`,
      widgetId: gristWidgetId(w.slug, channel),
      published: LISTED.has(w.status) && channel === majors.at(-1),
      accessLevel: w.access,
      // The SDK shows its own connecting screen until Grist is ready
      // (create-grist-widget's manifest says the same).
      renderAfterReady: false,
      description: w.description,
      authors: [{ name: "grist-widget-sdk", url: `${ORIGINS.primary}/widgets/` }],
      lastUpdatedAt: w.changes[0]?.date ? `${w.changes[0].date}T00:00:00.000Z` : undefined,
      gristWidgetSdk: {
        schema: 1,
        channel,
        version: channel === w.channel ? w.version : undefined,
        repository: w.source,
        license: w.license ?? undefined,
      },
    }))
  })
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`

/**
 * Writes catalog.json (the listed widgets) and grist-widgets.json (every
 * released major of every widget, see gristWidgetList) into `dir`, for
 * `origin`.
 */
export function writeSiteCatalog(dir, origin, { widgets = readWidgets(), channels = {} } = {}) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "catalog.json"), json(widgets.filter((w) => LISTED.has(w.status))))
  writeFileSync(join(dir, "grist-widgets.json"), json(gristWidgetList(widgets, origin, channels)))
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
  const widgets = readWidgets()
  const catalog = widgets.filter((w) => LISTED.has(w.status))
  if (www) {
    mkdirSync(dirname(resolve(www)), { recursive: true })
    writeFileSync(www, json(catalog))
  }
  if (site) writeSiteCatalog(site, arg("--origin") ?? ORIGINS.primary, { widgets })
  console.log(`catalog: ${catalog.length} widgets`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
