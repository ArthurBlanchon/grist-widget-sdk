#!/usr/bin/env node
// A widget that declares pure reference columns reads them as row ids in a
// real Grist (ADR 0022): the SDK asks for its records with expandRefs off,
// and Grist then sends each reference's own value, not the column it shows.
// ref-read/ is that widget, built here with the SDK's dist and embedded in a
// document where Owner shows a name, Helpers a list of names and Code a
// number: each must read as the row id it points to.
//
//   pnpm --filter grist-widget-sdk build
//   node scripts/real-widgets/ref-read.mjs
//
// Needs Docker and Chromium. Run by real-widgets.yml weekly and on demand,
// with the pinned Grist image create-grist-widget uses.

import { mkdtempSync, readFileSync, rmSync, createReadStream, existsSync, statSync } from "node:fs"
import http from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { chromium } from "playwright"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const fixture = path.join(root, "scripts/real-widgets/ref-read")
const { apiKey, createDocument, firstWorkspace, gristApi, openUrl, startGrist, stopGrist, GRIST_IMAGE } = await import(
  pathToFileURL(path.join(root, "packages/create-grist-widget/src/grist-local.mjs")).href
)

const CONTAINER = "grist-ref-read"
const PORT = 8598
const declared = JSON.parse(readFileSync(path.join(fixture, "widget.json"), "utf8"))

// Owner shows People's Name, Helpers a list of them, Code shows Codes' number.
const DEMO = {
  tables: {
    Tasks: {
      columns: { Title: "Text", Owner: "Ref:People", Helpers: "RefList:People", Code: "Ref:Codes" },
      rows: [{ Title: "Ship it", Owner: 2, Helpers: [1, 2], Code: 1 }],
    },
    People: { columns: { Name: "Text" }, rows: [{ Name: "Ada" }, { Name: "Grace" }] },
    Codes: { columns: { Number: "Numeric" }, rows: [{ Number: 100 }] },
  },
}
const EXPECTED = { Owner: 2, Helpers: [1, 2], Code: 1 }

/** The fixture built with the SDK's dist and the React the SDK is tested with. */
async function build() {
  const core = createRequire(path.join(root, "packages/core/package.json"))
  const { build: viteBuild } = await import(pathToFileURL(core.resolve("vite")).href)
  const outDir = mkdtempSync(path.join(tmpdir(), "ref-read-"))
  await viteBuild({
    root: fixture,
    base: "./",
    logLevel: "warn",
    configFile: false,
    esbuild: { jsx: "automatic" },
    resolve: {
      alias: [
        { find: /^grist-widget-sdk\/app$/, replacement: path.join(root, "packages/core/dist/app.js") },
        { find: /^grist-widget-sdk$/, replacement: path.join(root, "packages/core/dist/index.js") },
        { find: /^react-dom(\/.*)?$/, replacement: `${path.dirname(core.resolve("react-dom/package.json"))}$1` },
        { find: /^react(\/.*)?$/, replacement: `${path.dirname(core.resolve("react/package.json"))}$1` },
      ],
    },
    build: { outDir, emptyOutDir: true },
  })
  return outDir
}

function serve(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let f
      try {
        f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname))
      } catch {
        f = ""
      }
      if (!f.startsWith(dir + path.sep) || !existsSync(f) || statSync(f).isDirectory()) f = path.join(dir, "index.html")
      res.writeHead(200, { "Content-Type": types[path.extname(f)] ?? "application/octet-stream" })
      createReadStream(f).pipe(res)
    })
    server.listen(0, "127.0.0.1", () => resolve(server))
  })
}

const dist = await build()
const server = await serve(dist)
const origin = `http://127.0.0.1:${server.address().port}`
let read = null
let failure = null
let browser = null
try {
  const gristUrl = await startGrist({ container: CONTAINER, port: PORT })
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const api = gristApi(gristUrl, await apiKey(gristUrl))
  const options = { requiredAccess: declared.requiredAccess, columns: declared.columns }
  const { docId, viewId } = await createDocument(api, await firstWorkspace(api), "ref read", options, `${origin}/`, DEMO)
  const context = await browser.newContext()
  // The page loads the plugin API from docs.getgrist.com: serve this Grist's own copy.
  await context.route("https://docs.getgrist.com/grist-plugin-api.js", async (route) => {
    const r = await fetch(`${gristUrl}/grist-plugin-api.js`)
    await route.fulfill({ status: 200, contentType: "text/javascript", body: await r.text() })
  })
  await context.request.get(`${gristUrl}/login`)
  const page = await context.newPage()
  await page.goto(openUrl(gristUrl, docId, viewId))
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline && read === null) {
    const frame = page.frames().find((f) => f.url().startsWith(origin))
    const text = frame ? await frame.locator("#out").textContent({ timeout: 1000 }).catch(() => "") : ""
    if (text) read = JSON.parse(text)
    else await page.waitForTimeout(500)
  }
  if (read === null) {
    const frame = page.frames().find((f) => f.url().startsWith(origin))
    const shown = frame ? (await frame.evaluate(() => document.body.innerText).catch(() => "")).trim().slice(0, 300) : "no widget frame"
    failure = `the widget read no record within 60 s; it shows: ${JSON.stringify(shown)}`
    if (process.env.REF_READ_SCREENSHOT) await page.screenshot({ path: process.env.REF_READ_SCREENSHOT })
  }
} catch (e) {
  failure = String(e)
} finally {
  await browser?.close()
  server.close()
  stopGrist(CONTAINER)
  rmSync(dist, { recursive: true, force: true })
}

const ok = !failure && JSON.stringify(read) === JSON.stringify(EXPECTED)
console.log(`${ok ? "ok  " : "FAIL"} read ${JSON.stringify(read)}, expected ${JSON.stringify(EXPECTED)}${failure ? ` (${failure})` : ""}`)
console.log(ok ? `ref read: declared references read as row ids (${GRIST_IMAGE})` : `ref read: failed in ${GRIST_IMAGE}`)
if (!ok) process.exitCode = 1
