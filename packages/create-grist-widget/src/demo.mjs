// `create-grist-widget demo` (`pnpm demo` in a widget): the widget inside a
// real Grist on this machine, with no account. Plan step 7,
// docs/history/2026-11-01-widget-lifecycle-plan.md.
//
// 1. Starts the widget's Vite dev server (its own Vite and config), so edits
//    reload in place.
// 2. Starts Grist from the pinned Docker image, without authentication.
// 3. Creates a document from the widget's GRIST_OPTIONS: a table with a typed
//    column per declared column and sample rows, and the widget's section
//    with the access it requests, every column mapped, linked to the table.
// 4. Prints the URL that opens it, and on Ctrl-C stops both. The document
//    goes with the container: each run starts from a fresh one.
//
// Real Grist, not the emulator: what `pnpm dev` deliberately doesn't fake.
// Docker is needed for this command only; dev, test and deploy never need it.

import { readFileSync } from "node:fs"
import path from "node:path"

import { mkdirSync, writeFileSync } from "node:fs"

import { demoPageHtml, DEMO_URL_PLACEHOLDER } from "./demo-page.mjs"
import {
  apiKey,
  createDocument,
  dockerAvailable,
  firstWorkspace,
  GRIST_IMAGE,
  gristApi,
  openUrl,
  readGristOptions,
  readWidgetExports,
  startGrist,
  stopGrist,
  viteConfigFile,
  widgetVite,
} from "./grist-local.mjs"

export const DEMO_CONTAINER = "grist-widget-demo"
export const DEMO_GRIST_PORT = 8484

/** `--port <n>` (Grist's port) and `--save` from the arguments. */
export function demoArgs(argv) {
  const out = { gristPort: DEMO_GRIST_PORT, save: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") continue // `pnpm demo -- --port 9090` passes it through
    else if (argv[i] === "--port") out.gristPort = Number(argv[++i])
    else if (argv[i] === "--save") out.save = true
    else throw new Error(`demo: unknown argument ${JSON.stringify(argv[i])}. Usage: create-grist-widget demo [--save] [--port <grist port>]`)
  }
  if (!Number.isInteger(out.gristPort) || out.gristPort < 1 || out.gristPort > 65535) {
    throw new Error("demo: --port takes a port number")
  }
  return out
}

/** Why `demo` can't run in `cwd`, or null. */
export function demoRefusal(cwd, { docker = dockerAvailable } = {}) {
  let pkg
  try {
    pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"))
  } catch {
    return "demo: run it in a widget, where package.json is."
  }
  if (!pkg.dependencies?.["grist-widget-sdk"]) return "demo: this is not a grist-widget-sdk widget (no grist-widget-sdk dependency in package.json)."
  if (!docker()) {
    return "demo: Docker isn't running. The demo runs Grist in Docker: start Docker Desktop (or the docker service), then run it again. `pnpm test` and the dev branch's /dev/ preview need no Docker."
  }
  return null
}

const PLUGIN_API = "https://docs.getgrist.com/grist-plugin-api.js"

/**
 * Serves the widget the plugin API of the Grist it runs in, rather than
 * docs.getgrist.com's: the demo then works offline, and the API matches that
 * Grist's version. Only the dev server's HTML changes, never the widget's files.
 */
export function localPluginApi(gristUrl) {
  return {
    name: "grist-widget-demo:local-plugin-api",
    transformIndexHtml: (html) => html.replaceAll(PLUGIN_API, `${gristUrl}/grist-plugin-api.js`),
  }
}

export async function runDemo({ cwd, gristPort = DEMO_GRIST_PORT, log = console.log }) {
  const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"))
  const { options, from } = await readGristOptions(cwd)
  log(`Widget declaration from ${from}`)

  const gristUrl = `http://localhost:${gristPort}`
  const vite = await widgetVite(cwd)
  const server = await vite.createServer({
    root: cwd,
    configFile: viteConfigFile(cwd),
    server: { host: "localhost" },
    plugins: [localPluginApi(gristUrl)],
  })
  await server.listen()
  const widgetUrl = server.resolvedUrls?.local?.[0]
  if (!widgetUrl) throw new Error("demo: the Vite dev server has no local URL")
  log(`Widget dev server: ${widgetUrl}`)

  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    stopGrist(DEMO_CONTAINER)
    await server.close()
  }
  try {
    log(`Starting Grist (${GRIST_IMAGE}) on port ${gristPort}; the first run downloads the image...`)
    await startGrist({ container: DEMO_CONTAINER, port: gristPort })
    const api = gristApi(gristUrl, await apiKey(gristUrl))
    const { docId, viewId } = await createDocument(api, await firstWorkspace(api), pkg.name, options, widgetUrl)
    // A new document starts with an empty Table1: only the widget's page is left.
    await api("POST", `/api/docs/${docId}/apply`, [["RemoveTable", "Table1"]])
    return { url: openUrl(gristUrl, docId, viewId), stop }
  } catch (e) {
    await stop()
    throw e
  }
}

/** Where `demo --save` writes: Vite copies public/ into every build, so each channel serves <channel>/demo/. */
export const DEMO_DIR = path.join("public", "demo")

/**
 * A demo document from `options` in the Grist at `gristUrl` (API key `key`):
 * the same table, sample rows and mapped section as `pnpm demo`, with the
 * widget at the placeholder URL the demo page replaces. Returns the .grist
 * bytes.
 */
export async function createDemoDocument({ gristUrl, key, options, name }) {
  const api = gristApi(gristUrl, key)
  const { docId } = await createDocument(api, await firstWorkspace(api), name, options, DEMO_URL_PLACEHOLDER)
  await api("POST", `/api/docs/${docId}/apply`, [["RemoveTable", "Table1"]])
  const res = await fetch(`${gristUrl}/api/docs/${docId}/download?nohistory=true`, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`demo: downloading the document failed (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

/** Runs `fn({ gristUrl, key })` against a Grist started for it (pinned Docker image), then stops it. */
export async function withLocalGrist(fn, { gristPort = DEMO_GRIST_PORT, container = `${DEMO_CONTAINER}-save`, log = console.log } = {}) {
  const gristUrl = `http://localhost:${gristPort}`
  log(`Starting Grist (${GRIST_IMAGE}) on port ${gristPort}; the first run downloads the image...`)
  await startGrist({ container, port: gristPort })
  try {
    return await fn({ gristUrl, key: await apiKey(gristUrl) })
  } finally {
    stopGrist(container)
  }
}

/**
 * `demo --save`: writes public/demo/demo.grist and public/demo/index.html.
 * Both are the widget's: commit them, and edit the document in any Grist
 * (open it, change the data, download it back) — keep the widget section's
 * URL as it is, the page points it at the widget.
 */
export async function saveDemo({ cwd, gristPort = DEMO_GRIST_PORT, log = console.log }) {
  const pkg = JSON.parse(readFileSync(path.join(cwd, "package.json"), "utf8"))
  const { options, metadata } = await readWidgetExports(cwd)
  const title = metadata?.title || pkg.name
  const bytes = await withLocalGrist((grist) => createDemoDocument({ ...grist, options, name: title }), { gristPort, log })
  const dir = path.join(cwd, DEMO_DIR)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, "demo.grist"), bytes)
  writeFileSync(path.join(dir, "index.html"), demoPageHtml({ title }))
  return { dir }
}
