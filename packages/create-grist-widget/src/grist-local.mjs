// A Grist on this machine, from a pinned Docker image, with a document
// generated from a widget's GRIST_OPTIONS: what `create-grist-widget demo`
// (a real local demo) and the SDK repo's real-widget checks
// (scripts/real-widgets/e2e-grist.mjs) share. Plan R3b and step 7 of
// docs/history/2026-11-01-widget-lifecycle-plan.md.
//
// No account and no browser: Grist runs without authentication, as the
// default user, and the API key comes from signing in over HTTP.

import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"

/** The Grist image, pinned so a Grist release can't change a run; GRIST_IMAGE tries another. */
export const GRIST_IMAGE = process.env.GRIST_IMAGE || "gristlabs/grist:1.7.22"

// ---------------------------------------------------------------------------
// The widget's GRIST_OPTIONS
// ---------------------------------------------------------------------------

/** The Vite config file a widget uses, if any. */
export function viteConfigFile(widgetDir) {
  return ["vite.config.ts", "vite.config.js", "vite.config.mjs"].map((f) => path.join(widgetDir, f)).find(existsSync)
}

/** The widget's own Vite, the one its package.json installs. */
export async function widgetVite(widgetDir) {
  const require = createRequire(path.join(widgetDir, "package.json"))
  return import(pathToFileURL(require.resolve("vite")).href)
}

const EXPORT_FILES = ["src/app/widget.ts", "src/app/grist-options.ts", "src/grist-options.ts", "src/app/App.tsx", "src/App.tsx"]

/**
 * The widget's options and metadata (its `widget` declaration, or GRIST_OPTIONS
 * and WIDGET_METADATA), loaded through its own Vite
 * config. Options files first: they import no UI, so App.tsx (which may
 * import browser-only code) is loaded only for what they don't export.
 */
export async function readWidgetExports(widgetDir) {
  const vite = await widgetVite(widgetDir)
  const server = await vite.createServer({
    root: widgetDir,
    configFile: viteConfigFile(widgetDir),
    server: { middlewareMode: true, hmr: false, watch: null },
    // Only module loading in Node is needed: no browser dependency pre-bundling.
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
    logLevel: "error",
  })
  const found = { options: null, from: null, metadata: null, metadataFrom: null }
  const errors = []
  try {
    for (const rel of EXPORT_FILES) {
      if (found.options && found.metadata) break
      if (!existsSync(path.join(widgetDir, rel))) continue
      try {
        const mod = await server.ssrLoadModule("/" + rel)
        // A defineGristWidget() declaration carries both; a widget made before
        // it exports GRIST_OPTIONS and WIDGET_METADATA.
        const declared = isDeclaration(mod.widget) ? mod.widget : null
        const options = declared?.options ?? mod.GRIST_OPTIONS
        const metadata = declared?.metadata?.title ? declared.metadata : mod.WIDGET_METADATA
        if (!found.options && options) Object.assign(found, { options, from: rel })
        if (!found.metadata && metadata) Object.assign(found, { metadata, metadataFrom: rel })
      } catch (e) {
        errors.push(`${rel}: ${String(e?.message ?? e).split("\n")[0]}`)
      }
    }
  } finally {
    await server.close()
  }
  if (!found.options) {
    throw new Error(
      `no \`widget\` (defineGristWidget) or GRIST_OPTIONS export found in ${widgetDir}${errors.length ? ` (${errors.join("; ")})` : ""}`
    )
  }
  return found
}

/** A `defineGristWidget()` result: its options, metadata and declaration. */
function isDeclaration(value) {
  return typeof value === "object" && value !== null && typeof value.options === "object" && "definition" in value
}

/** GRIST_OPTIONS, loaded through the widget's own Vite config. */
export async function readGristOptions(widgetDir) {
  const { options, from } = await readWidgetExports(widgetDir)
  return { options, from }
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

const SIMPLE_TYPES = ["Text", "Numeric", "Int", "Bool", "Date", "DateTime", "Choice", "ChoiceList", "Attachments", "Any"]

/** The Grist column type for a declared column: the first simple type it accepts (Ref-only falls back to Text). */
export function columnType(declared) {
  const accepted = String(declared ?? "Any").split(",").map((t) => t.trim())
  return accepted.find((t) => SIMPLE_TYPES.includes(t)) ?? "Text"
}

/** A sample value of `type` for row `i` (0-based). Dates start today, so time-based widgets show them. */
export function sampleValue(type, name, i, now = new Date()) {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 1000
  switch (type) {
    case "Numeric":
    case "Int":
      return 10 * (i + 1)
    case "Bool":
      return i % 2 === 0
    case "Date":
      return day + i * 86400
    case "DateTime":
      return Math.floor(now.getTime() / 1000) + i * 3600
    case "Choice":
      return ["Option A", "Option B"][i % 2]
    case "ChoiceList":
      return ["L", ["Option A", "Option B"][i % 2]]
    case "Attachments":
      return null
    default:
      return `${name} ${i + 1}`
  }
}

/** The table's columns and rows for a widget's declared columns (a single "Name" column when it declares none). */
export function documentSpec(options, rowCount = 3) {
  const declared = options.columns?.length ? options.columns : [{ name: "Name", type: "Text" }]
  const columns = declared.map((c) => {
    const name = typeof c === "string" ? c : c.name
    const type = columnType(typeof c === "string" ? "Any" : c.type)
    const fields = { type, label: name }
    if (type === "Choice" || type === "ChoiceList") fields.widgetOptions = JSON.stringify({ choices: ["Option A", "Option B"] })
    return { id: name, fields, allowMultiple: typeof c === "object" && !!c.allowMultiple, mapped: !!options.columns?.length }
  })
  const rows = Array.from({ length: rowCount }, (_, i) =>
    Object.fromEntries(columns.map((c) => [c.id, sampleValue(c.fields.type, c.id, i)]))
  )
  return { columns, rows }
}

export function gristApi(baseUrl, key) {
  return async (method, url, body) => {
    const r = await fetch(baseUrl + url, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`${method} ${url}: ${r.status} ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : null
  }
}

export async function createDocument(api, wsId, name, options, widgetUrl) {
  const spec = documentSpec(options)
  const docId = await api("POST", `/api/workspaces/${wsId}/docs`, { name })
  await api("POST", `/api/docs/${docId}/tables`, {
    tables: [{ id: "Data", columns: spec.columns.map(({ id, fields }) => ({ id, fields })) }],
  })
  await api("POST", `/api/docs/${docId}/tables/Data/records`, { records: spec.rows.map((fields) => ({ fields })) })
  const sql = async (q) => (await api("GET", `/api/docs/${docId}/sql?q=${encodeURIComponent(q)}`)).records.map((r) => r.fields)
  const [table] = await sql("select id, primaryViewId from _grist_Tables where tableId = 'Data'")
  const cols = await sql(`select id, colId from _grist_Tables_column where parentId = ${table.id}`)
  const colRef = Object.fromEntries(cols.map((c) => [c.colId, c.id]))
  const [recordSection] = await sql(
    `select id from _grist_Views_section where parentId = ${table.primaryViewId} and parentKey = 'record'`
  )
  const res = await api("POST", `/api/docs/${docId}/apply`, [
    ["CreateViewSection", table.id, table.primaryViewId, "custom", null, null],
  ])
  const sectionRef = res.retValues[0].sectionRef
  const columnsMapping = Object.fromEntries(
    spec.columns.filter((c) => c.mapped).map((c) => [c.id, c.allowMultiple ? [colRef[c.id]] : colRef[c.id]])
  )
  const customView = {
    mode: "url",
    url: widgetUrl,
    access: options.requiredAccess ?? "none",
    columnsMapping,
    renderAfterReady: false,
  }
  await api("POST", `/api/docs/${docId}/apply`, [
    [
      "UpdateRecord",
      "_grist_Views_section",
      sectionRef,
      { options: JSON.stringify({ customView: JSON.stringify(customView) }), title: name, linkSrcSectionRef: recordSection.id },
    ],
  ])
  return { docId, viewId: table.primaryViewId }
}

// ---------------------------------------------------------------------------
// Grist
// ---------------------------------------------------------------------------

function docker(args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
}

/** Whether a Docker daemon answers. */
export function dockerAvailable() {
  try {
    docker(["version", "--format", "{{.Server.Version}}"])
    return true
  } catch {
    return false
  }
}

export async function waitFor(url, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`${url} did not answer within ${seconds} s`)
}

/**
 * Starts Grist in a container named `container` (replacing one of that name),
 * on localhost:`port`, without authentication: every visitor is `email`.
 * Returns its URL. `stopGrist(container)` removes it.
 */
export async function startGrist({ container, port, email = "you@example.com", image = GRIST_IMAGE }) {
  stopGrist(container)
  const url = `http://localhost:${port}`
  docker([
    "run", "-d", "--name", container, "-p", `127.0.0.1:${port}:8484`,
    "-e", "GRIST_IN_SERVICE=true",
    "-e", `GRIST_DEFAULT_EMAIL=${email}`,
    "-e", "GRIST_SINGLE_ORG=docs",
    "-e", "GRIST_SANDBOX_FLAVOR=unsandboxed",
    "-e", `APP_HOME_URL=${url}`,
    image,
  ])
  await waitFor(`${url}/status`, 180)
  return url
}

export function stopGrist(container) {
  try {
    docker(["rm", "-f", container])
  } catch {
    // none running
  }
}

/** Signs in as the default user over HTTP, following redirects with a cookie jar, and returns an API key. */
export async function apiKey(gristUrl) {
  const jar = new Map()
  const request = async (url, init = {}) => {
    for (let hop = 0; hop < 10; hop++) {
      const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ")
      const r = await fetch(url, { ...init, redirect: "manual", headers: { ...init.headers, cookie } })
      for (const c of r.headers.getSetCookie()) {
        const [pair] = c.split(";")
        const i = pair.indexOf("=")
        jar.set(pair.slice(0, i), pair.slice(i + 1))
      }
      const location = r.headers.get("location")
      if (r.status < 300 || r.status >= 400 || !location) return r
      url = new URL(location, url).href
      init = {}
    }
    throw new Error(`${url}: too many redirects`)
  }
  await request(`${gristUrl}/login`)
  const headers = { "X-Requested-With": "XMLHttpRequest" }
  let key = (await (await request(`${gristUrl}/api/profile/apiKey`, { headers })).text()).trim()
  if (!key) {
    const r = await request(`${gristUrl}/api/profile/apiKey`, { method: "POST", headers })
    if (!r.ok) throw new Error(`could not get a Grist API key: ${r.status} ${await r.text()}`)
    key = (await r.text()).trim()
  }
  return key
}

/** The default user's first workspace. */
export async function firstWorkspace(api) {
  const [org] = await api("GET", "/api/orgs")
  const [ws] = await api("GET", `/api/orgs/${org.id}/workspaces`)
  return ws.id
}

/** A URL that signs the browser in as the default user, then opens the document's page `viewId`. */
export function openUrl(gristUrl, docId, viewId) {
  return `${gristUrl}/login?next=${encodeURIComponent(`/doc/${docId}${viewId ? `/p/${viewId}` : ""}`)}`
}
