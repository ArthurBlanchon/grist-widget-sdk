// A Grist on this machine, from a pinned Docker image, with a document
// generated from a widget's GRIST_OPTIONS: what `create-grist-widget demo`
// (a real local demo) and the SDK repo's real-widget checks
// (scripts/real-widgets/e2e-grist.mjs) share. Plan R3b and step 7 of
// docs/history/2026-11-01-widget-lifecycle-plan.md.
//
// No account and no browser: Grist runs without authentication, as the
// default user, and the API key comes from signing in over HTTP.

import { execFileSync } from "node:child_process"
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs"
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

const DEMO_FILE = "src/app/demo.ts"
const EXPORT_FILES = ["src/app/widget.ts", "src/app/grist-options.ts", "src/grist-options.ts", "src/app/App.tsx", "src/App.tsx"]

/**
 * The widget's options and metadata (its `widget` declaration, or GRIST_OPTIONS
 * and WIDGET_METADATA), loaded through its own Vite
 * config. Options files first: they import no UI, so App.tsx (which may
 * import browser-only code) is loaded only for what they don't export.
 */
export async function readWidgetExports(widgetDir, { demo: withDemo = false } = {}) {
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
  const found = { options: null, from: null, metadata: null, metadataFrom: null, demo: null }
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
    // Its demo data (GristWidgetDemo), when it has some, and only when asked:
    // the manifest a deploy writes doesn't depend on it.
    if (withDemo && existsSync(path.join(widgetDir, DEMO_FILE))) {
      try {
        // `files` is this loader's own (the bytes it reads), never the module's.
        const loaded = (await server.ssrLoadModule("/" + DEMO_FILE)).demo
        if (loaded && typeof loaded === "object") delete loaded.files
        found.demo = withDemoFiles(checkDemo(loaded), widgetDir)
      } catch (e) {
        throw new Error(`${DEMO_FILE}: ${String(e?.message ?? e).split("\n")[0]}`, { cause: e })
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

/** Where a widget's demo attachments are: `src/app/demo/`, next to `demo.ts`. */
export const DEMO_FILES_DIR = "src/app/demo"
const DEMO_FILE_MAX = 2e6

/**
 * The demo with the files its Attachments cells name, read from
 * `src/app/demo/` (`files`, by name, base64): createDocument uploads them,
 * and a change to one changes the catalog demo's hash.
 */
export function withDemoFiles(demo, widgetDir) {
  const names = new Set()
  for (const t of Object.values(demo.tables)) {
    for (const [col, type] of Object.entries(t.columns)) {
      if (type !== "Attachments") continue
      for (const row of t.rows) for (const n of row[col] ?? []) names.add(n)
    }
  }
  if (!names.size) return demo
  const files = {}
  const dir = path.join(widgetDir, DEMO_FILES_DIR)
  for (const n of [...names].sort()) {
    const file = path.join(dir, n)
    if (!existsSync(file)) throw new Error(`demo: ${n} isn't in ${DEMO_FILES_DIR}/`)
    // A plain file of the folder only: a link could publish a file of the machine
    // that builds the demo (a CI runner's .git/config) in the public demo page.
    const stat = lstatSync(file)
    if (!stat.isFile() || path.dirname(realpathSync(file)) !== realpathSync(dir)) {
      throw new Error(`demo: ${DEMO_FILES_DIR}/${n} isn't a plain file of that folder (no link)`)
    }
    if (stat.size > DEMO_FILE_MAX) throw new Error(`demo: ${DEMO_FILES_DIR}/${n} is over ${DEMO_FILE_MAX / 1e6} MB`)
    files[n] = readFileSync(file).toString("base64")
  }
  return { ...demo, files }
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

/** The demo data's format, part of the catalog demos' hash: a change regenerates them. */
export const DEMO_FORMAT = 4

const DEMO_TYPES = ["Text", "Numeric", "Int", "Bool", "Date", "DateTime", "Choice", "ChoiceList", "Attachments", "Any"]
// An attachment: a file of src/app/demo/, by its name.
const DEMO_FILE_NAME = /^[\w][\w.-]*\.(png|jpe?g|gif|webp|pdf|txt|csv)$/i
// Ids Grist would rename (a new document's Table1, its own columns, Python's keywords).
const RESERVED_IDS = new Set(["Table1", "id", "manualSort", ...["and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "None", "True", "False"]])
const DAY = /^\d{4}-\d{2}-\d{2}$/
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

const baseType = (type) => (/^DateTime:/.test(type) ? "DateTime" : type)

/** Problems with one demo cell, or null. */
function cellProblem(type, value, rowCounts) {
  if (value === null) return null
  const ref = /^(Ref|RefList):(.+)$/.exec(type)
  if (ref) {
    const position = (v) => Number.isInteger(v) && v >= 1 && v <= rowCounts[ref[2]]
    const range = `of ${ref[2]}, 1 to ${rowCounts[ref[2]]}`
    if (ref[1] === "Ref") return position(value) ? null : `a row position ${range}`
    return Array.isArray(value) && value.every(position) ? null : `a list of row positions ${range}`
  }
  switch (baseType(type)) {
    case "Date":
      return typeof value === "string" && DAY.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ? null : 'a "YYYY-MM-DD" string'
    case "DateTime":
      return typeof value === "string" && INSTANT.test(value) && Number.isFinite(Date.parse(value)) ? null : "an ISO string with its offset (Z or ±hh:mm)"
    case "Numeric":
      return typeof value === "number" && Number.isFinite(value) ? null : "a number"
    case "Int":
      return Number.isInteger(value) ? null : "an integer"
    case "Bool":
      return typeof value === "boolean" ? null : "true or false"
    case "ChoiceList":
      return Array.isArray(value) && value.every((v) => typeof v === "string") ? null : "an array of strings"
    case "Attachments":
      return Array.isArray(value) && value.every((v) => typeof v === "string" && DEMO_FILE_NAME.test(v))
        ? null
        : `a list of file names of ${DEMO_FILES_DIR}/ (an image, a PDF, a text or CSV file)`
    case "Text":
    case "Choice":
      return typeof value === "string" ? null : "a string"
    default:
      return Array.isArray(value) || (typeof value === "object" && value !== null) ? "a string, number or boolean" : null
  }
}

/** A widget's demo data (GristWidgetDemo), checked: ids, types, references, every cell. */
export function checkDemo(demo) {
  if (!demo || typeof demo !== "object" || !demo.tables || typeof demo.tables !== "object") {
    throw new Error("export const demo: GristWidgetDemo, with its tables")
  }
  const names = Object.keys(demo.tables)
  if (!names.length) throw new Error("demo: no table")
  const rowCounts = {}
  for (const [name, t] of Object.entries(demo.tables)) {
    if (!/^[A-Z][A-Za-z0-9_]*$/.test(name) || RESERVED_IDS.has(name)) throw new Error(`demo: table ${name} isn't a Grist table id this document can take`)
    if (!t || typeof t !== "object" || !t.columns || typeof t.columns !== "object" || !Array.isArray(t.rows)) {
      throw new Error(`demo: table ${name} needs columns and rows`)
    }
    rowCounts[name] = t.rows.length
  }
  for (const [name, t] of Object.entries(demo.tables)) {
    for (const [col, type] of Object.entries(t.columns)) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(col) || RESERVED_IDS.has(col)) throw new Error(`demo: ${name}.${col} isn't a Grist column id this document can take`)
      const ref = /^(?:Ref|RefList):(.+)$/.exec(type)
      const known = ref ? names.includes(ref[1]) : DEMO_TYPES.includes(baseType(type)) && (!/^DateTime:/.test(type) || /^DateTime:[\w/+-]+$/.test(type))
      if (!known) throw new Error(`demo: ${name}.${col}'s type ${type} isn't one a demo takes (${DEMO_TYPES.join(", ")}, DateTime:<zone>, Ref:<table>, RefList:<table>)`)
    }
    for (const [col, styles] of Object.entries(t.choiceColors ?? {})) {
      const hex = /^#[0-9A-Fa-f]{6}$/
      const fine =
        ["Choice", "ChoiceList"].includes(t.columns[col]) &&
        styles && typeof styles === "object" &&
        Object.values(styles).every((v) => v && typeof v === "object" && Object.entries(v).every(([k, c]) => ["fillColor", "textColor"].includes(k) && hex.test(c)))
      if (!fine) throw new Error(`demo: ${name}.choiceColors.${col} gives a Choice or ChoiceList column's choices a fillColor and textColor, "#RRGGBB"`)
    }
    for (const [col, list] of Object.entries(t.choices ?? {})) {
      if (!["Choice", "ChoiceList"].includes(t.columns[col]) || !Array.isArray(list)) throw new Error(`demo: ${name}.choices.${col} lists the choices of a Choice or ChoiceList column`)
    }
    t.rows.forEach((row, i) => {
      for (const [col, value] of Object.entries(row)) {
        if (!(col in t.columns)) throw new Error(`demo: ${name} row ${i + 1} has ${col}, which isn't one of its columns`)
        const problem = cellProblem(t.columns[col], value, rowCounts)
        if (problem) throw new Error(`demo: ${name} row ${i + 1}, ${col} (${t.columns[col]}): ${JSON.stringify(value)} isn't ${problem}`)
      }
    })
  }
  if (demo.table !== undefined && !names.includes(demo.table)) throw new Error(`demo: table ${demo.table} isn't one of its tables`)
  if (demo.options !== undefined && (typeof demo.options !== "object" || demo.options === null || Array.isArray(demo.options))) {
    throw new Error("demo: options is an object")
  }
  return demo
}

/** A checked demo cell as Grist's REST API takes it. */
function demoValue(type, value) {
  if (value === null || value === undefined) return null
  if (type === "Date") return Date.parse(`${value}T00:00:00Z`) / 1000
  if (baseType(type) === "DateTime") return Date.parse(value) / 1000
  if (type === "Attachments") return value.length ? value : null
  if (type === "ChoiceList" || type.startsWith("RefList:")) return ["L", ...value]
  return value
}

/**
 * The tables, rows, mapping and options of a widget's demo data, checked
 * against the widget's declaration. The widget's table comes first: a new
 * document opens on the first page, and so does the demo page.
 */
export function demoSpec(options, demo) {
  checkDemo(demo)
  const table = demo.table ?? Object.keys(demo.tables)[0]
  const order = [table, ...Object.keys(demo.tables).filter((n) => n !== table)]
  const tables = order.map((id) => {
    const t = demo.tables[id]
    return {
      id,
      columns: Object.entries(t.columns).map(([col, declared]) => {
        // A plain DateTime gets a zone, which Grist needs.
        const type = declared === "DateTime" ? "DateTime:UTC" : declared
        const fields = { type, label: col }
        if (type === "Choice" || type === "ChoiceList") {
          const seen = t.rows.flatMap((r) => (Array.isArray(r[col]) ? r[col] : r[col] == null ? [] : [r[col]])).map(String)
          const choices = [...new Set([...(t.choices?.[col] ?? []), ...seen])]
          const choiceOptions = t.choiceColors?.[col]
          fields.widgetOptions = JSON.stringify({ choices, ...(choiceOptions ? { choiceOptions } : {}) })
        }
        return { id: col, fields, ref: /^(?:Ref|RefList):(.+)$/.exec(type)?.[1] ?? null }
      }),
      rows: t.rows.map((r) => Object.fromEntries(Object.entries(r).map(([col, v]) => [col, demoValue(t.columns[col], v)]))),
    }
  })
  const widgetTable = tables[0]
  const declared = (options.columns ?? []).map((c) => (typeof c === "string" ? { name: c } : c))
  const names = new Set(declared.map((c) => c.name))
  for (const key of Object.keys(demo.mapping ?? {})) {
    if (!names.has(key)) throw new Error(`demo: mapping.${key} isn't a column the widget declares (${[...names].join(", ")})`)
  }
  const present = new Set(widgetTable.columns.map((c) => c.id))
  const mapping = {}
  for (const c of declared) {
    let cols = demo.mapping?.[c.name] ?? (present.has(c.name) ? c.name : null)
    if (cols === null) {
      if (!c.optional) throw new Error(`demo: ${c.name}, which the widget requires, maps to no column of ${table}`)
      continue
    }
    if (Array.isArray(cols) !== Boolean(c.allowMultiple) && !(c.allowMultiple && typeof cols === "string")) {
      throw new Error(`demo: mapping.${c.name} is ${c.allowMultiple ? "a list of columns" : "one column"}`)
    }
    if (c.allowMultiple && typeof cols === "string") cols = [cols]
    for (const col of [cols].flat()) {
      if (!present.has(col)) throw new Error(`demo: mapping.${c.name} names ${col}, which isn't a column of ${table}`)
    }
    mapping[c.name] = cols
  }
  // Options the widget versions are its current version's (ADR 0017).
  const widgetOptions = demo.options ? { ...demo.options, ...(options.optionsVersion ? { __version: options.optionsVersion } : {}) } : null
  return { tables, table, columns: widgetTable.columns, mapping, options: widgetOptions }
}

export function gristApi(baseUrl, key) {
  return async (method, url, body) => {
    // A FormData (an upload) goes as it is, with its own content type.
    const form = body instanceof FormData
    const r = await fetch(baseUrl + url, {
      method,
      headers: { Authorization: `Bearer ${key}`, ...(form ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`${method} ${url}: ${r.status} ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : null
  }
}

export async function createDocument(api, wsId, name, options, widgetUrl, demo = null) {
  const spec = demo ? demoSpec(options, demo) : documentSpec(options)
  const tables = spec.tables ?? [{ id: "Data", columns: spec.columns, rows: spec.rows }]
  const tableId = spec.table ?? "Data"
  const docId = await api("POST", `/api/workspaces/${wsId}/docs`, { name })
  // A reference is made an Int first: its target table may come later in
  // the bundle (the widget's table comes first), and Grist can't refer to it yet.
  await api("POST", `/api/docs/${docId}/tables`, {
    tables: tables.map((t) => ({
      id: t.id,
      columns: t.columns.map(({ id, fields, ref }) => ({ id, fields: ref ? { ...fields, type: fields.type.startsWith("RefList:") ? "Any" : "Int" } : fields })),
    })),
  })
  const sql = async (q) => (await api("GET", `/api/docs/${docId}/sql?q=${encodeURIComponent(q)}`)).records.map((r) => r.fields)
  // A new document's empty Table1 would be a page of its own, next to the
  // widget's: removed here, once, when the Grist image made one.
  if ((await sql("select id from _grist_Tables where tableId = 'Table1'")).length) {
    await api("POST", `/api/docs/${docId}/apply`, [["RemoveTable", "Table1"]])
  }
  // Then a Ref, showing its target's first column rather than a row id.
  const refs = tables.flatMap((t) => t.columns.filter((c) => c.ref).map((c) => ({ table: t.id, col: c.id, target: c.ref })))
  if (refs.length) {
    const ids = await sql("select c.id, c.colId, t.tableId from _grist_Tables_column c join _grist_Tables t on c.parentId = t.id")
    const ref = (tableId, colId) => ids.find((r) => r.tableId === tableId && r.colId === colId)?.id
    const first = (target) => tables.find((t) => t.id === target).columns[0]?.id
    await api(
      "POST",
      `/api/docs/${docId}/apply`,
      refs.flatMap(({ table, col, target }) => [
        ["ModifyColumn", table, col, { type: tables.find((t) => t.id === table).columns.find((c) => c.id === col).fields.type, visibleCol: ref(target, first(target)) }],
        ["SetDisplayFormula", table, null, ref(table, col), `$${col}.${first(target)}`],
      ])
    )
  }
  // The demo's files become the document's attachments, and each cell naming
  // them their ids; without the files (a static demo page, where grist-static
  // serves no attachment), the cells stay empty.
  if (demo && !demo.files) {
    for (const t of tables) {
      for (const c of t.columns.filter((c) => c.fields.type === "Attachments")) for (const row of t.rows) row[c.id] = null
    }
  }
  if (demo?.files) {
    const names = Object.keys(demo.files)
    const form = new FormData()
    for (const n of names) form.append("upload", new Blob([Buffer.from(demo.files[n], "base64")]), n)
    const ids = await api("POST", `/api/docs/${docId}/attachments`, form)
    const idOf = new Map(names.map((n, i) => [n, ids[i]]))
    for (const t of tables) {
      for (const c of t.columns.filter((c) => c.fields.type === "Attachments")) {
        for (const row of t.rows) if (Array.isArray(row[c.id])) row[c.id] = ["L", ...row[c.id].map((n) => idOf.get(n))]
      }
    }
  }
  for (const t of tables) {
    if (t.rows.length) await api("POST", `/api/docs/${docId}/tables/${t.id}/records`, { records: t.rows.map((fields) => ({ fields })) })
  }
  const [table] = await sql(`select id, primaryViewId from _grist_Tables where tableId = '${tableId}'`)
  const cols = await sql(`select id, colId from _grist_Tables_column where parentId = ${table.id}`)
  const colRef = Object.fromEntries(cols.map((c) => [c.colId, c.id]))
  const [recordSection] = await sql(
    `select id from _grist_Views_section where parentId = ${table.primaryViewId} and parentKey = 'record'`
  )
  const res = await api("POST", `/api/docs/${docId}/apply`, [
    ["CreateViewSection", table.id, table.primaryViewId, "custom", null, null],
  ])
  const sectionRef = res.retValues[0].sectionRef
  const columnsMapping = spec.mapping
    ? Object.fromEntries(
        Object.entries(spec.mapping).map(([declared, cols]) => [declared, Array.isArray(cols) ? cols.map((c) => colRef[c]) : colRef[cols]])
      )
    : Object.fromEntries(spec.columns.filter((c) => c.mapped).map((c) => [c.id, c.allowMultiple ? [colRef[c.id]] : colRef[c.id]]))
  const customView = {
    mode: "url",
    url: widgetUrl,
    access: options.requiredAccess ?? "none",
    // No mapping saved when nothing is mapped, as in Grist (it saves one only
    // when a column is mapped): a saved one, even empty, makes Grist send the
    // widget its mapped columns only, so none.
    columnsMapping: Object.keys(columnsMapping).length ? columnsMapping : null,
    renderAfterReady: false,
    // An object in customView (grist-core's ViewSectionRec customDef).
    ...(spec.options ? { widgetOptions: spec.options } : {}),
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
