#!/usr/bin/env node
// pnpm e2e:grist <widget dir>... : embed each widget's build in a real Grist
// and check it renders (plan R3b, docs/history/2026-11-01-widget-lifecycle-plan.md).
//
// For each widget:
//   1. its GRIST_OPTIONS are read off the real module export, loaded through
//      the widget's own Vite config in Node (as build-widgets-manifest.mjs
//      does for the examples): no source parsing, no per-widget config;
//   2. a document is generated from them in a local Grist (a pinned Docker
//      image, started here unless --grist-url points at one): the widget's
//      demo data (src/app/demo.ts) when it has some, otherwise a table with
//      a typed column per declared column and sample rows; the widget's
//      section with the access it requests, every column mapped, and linked
//      to the table so it has a selected row;
//   3. its `dist/` is served at /<name>/dev/ and opened in Chromium;
//   4. it passes when the widget renders past GristBoundary (none of its
//      connecting / unavailable / error / "map your columns" screens left
//      after the timeout) with no uncaught exception. Console errors are
//      reported, not failed on: they include services the widget calls;
//      with --strict-console, an error logged from the widget's own origin
//      fails it (a service's network failure comes from the service's).
//      A screenshot is kept.
//
// It checks the emulator rather than replacing it: a widget that passes
// smokeTestWidget() and fails here is an emulator parity bug.
//
// Options:
//   --build            run `vite build` in the widget first (default: use dist/)
//   --out <dir>        where screenshots go (default ./e2e-grist-output)
//   --grist-url <url>  use a running Grist instead of starting one
//   --keep             leave Grist running and print each document's URL
//   --timeout <s>      seconds to wait for the widget (default 20)
//   --axe              fail on a serious or critical accessibility violation (axe-core, WCAG 2 A and AA)
//   --strict-console   fail on an error the widget logs to the console (the catalog's CI uses it)
//   --themes           also screenshot it with the browser in dark mode (<name>-dark.png)
//   --standard         the standard criteria (plan 0.8 §3): the widget at 320 px and
//                      at 1,280 px without horizontal overflow (<name>-320.png,
//                      <name>-1280.png); a keyboard path (Tab through, Escape, then
//                      axe again with --axe) that reaches a control when there is one;
//                      and the document open read-only (/m/view): it renders, and a
//                      widget asking for full access shows the read-only alert
//
// Needs Docker (unless --grist-url) and Playwright's Chromium. The browser
// path can be forced with CHROMIUM_PATH, the Grist image with GRIST_IMAGE.

import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from "node:fs"
import http from "node:http"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { chromium } from "playwright"

// Grist, the generated document and GRIST_OPTIONS come from create-grist-widget,
// which `create-grist-widget demo` runs on in a widget.
import {
  apiKey,
  createDocument,
  GRIST_IMAGE,
  gristApi,
  readWidgetExports,
  startGrist,
  stopGrist,
} from "../../packages/create-grist-widget/src/grist-local.mjs"

export { columnType, documentSpec, GRIST_IMAGE, sampleValue } from "../../packages/create-grist-widget/src/grist-local.mjs"

const CONTAINER = "grist-widget-e2e"
const GRIST_PORT = 8585
const EMAIL = "e2e@example.com"

// GristBoundary's screens (packages/core/src/sdk/components/grist-boundary.tsx,
// helpers/grist-boundary-view.ts): still showing one after the timeout fails.
const BOUNDARY_TITLES = ["Connecting to Grist", "Open inside Grist", "Something went wrong", "Map your columns"]

export function parseArgs(argv) {
  const out = { dirs: [], build: false, out: "e2e-grist-output", gristUrl: null, keep: false, timeout: 20, axe: false, themes: false, strictConsole: false, standard: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--build") out.build = true
    else if (a === "--keep") out.keep = true
    else if (a === "--axe") out.axe = true
    else if (a === "--themes") out.themes = true
    else if (a === "--strict-console") out.strictConsole = true
    else if (a === "--standard") out.standard = true
    else if (a === "--out") out.out = argv[++i]
    else if (a === "--grist-url") out.gristUrl = argv[++i]
    else if (a === "--timeout") out.timeout = Number(argv[++i])
    else out.dirs.push(path.resolve(a))
  }
  return out
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".woff2": "font/woff2" }

/**
 * The file of `dist` a request path asks for: the path itself, else the path
 * without its `/<name>/dev` prefix (a build with relative URLs, such as a
 * catalog widget's, asks for /<name>/dev/assets/…), else index.html, so
 * /<name>/dev/ (what older widgets need to render as a widget) loads it.
 */
export function distFile(dist, requestPath) {
  const isFile = (f) => f.startsWith(dist) && existsSync(f) && !statSync(f).isDirectory()
  const direct = path.join(dist, requestPath)
  if (isFile(direct)) return direct
  const unprefixed = path.join(dist, requestPath.split("/").slice(3).join("/"))
  if (isFile(unprefixed)) return unprefixed
  return path.join(dist, "index.html")
}

/** Serve `dist` (see distFile). */
function serve(dist) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const f = distFile(dist, decodeURIComponent(new URL(req.url, "http://x").pathname))
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] ?? "application/octet-stream" })
      createReadStream(f).pipe(res)
    })
    server.listen(0, "127.0.0.1", () => resolve(server))
  })
}

// ---------------------------------------------------------------------------
// One widget
// ---------------------------------------------------------------------------

/** The axe-core violations that fail the check: serious or critical, WCAG 2 A and AA. */
export const failingViolations = (violations) => violations.filter((v) => v.impact === "serious" || v.impact === "critical")

/** Wait until the widget's frame renders past GristBoundary: its state and the frame. */
async function waitRendered(page, origin, timeout) {
  let state = "no widget frame"
  let found = null
  const deadline = Date.now() + timeout * 1000
  while (Date.now() < deadline) {
    const frame = page.frames().find((f) => f.url().startsWith(origin))
    if (frame) {
      found = frame
      state = await frame
        .evaluate((titles) => {
          for (const h of document.querySelectorAll('[role="status"] h2, [role="alert"] h2')) {
            if (titles.includes(h.textContent.trim())) return `stuck on "${h.textContent.trim()}"`
          }
          const body = document.body
          return body && (body.innerText.trim() || body.querySelector("canvas, svg, img, input, button")) ? "rendered" : "blank"
        }, BOUNDARY_TITLES)
        .catch(() => "loading")
      if (state === "rendered") break
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return { state, frame: found }
}

/** The widget's frame element in Grist's page, pinned at `width` (a side panel at 320, a full page at 1,280). */
async function pinWidth(page, origin, width) {
  const found = await page.evaluate(
    ({ origin, width }) => {
      const el = [...document.querySelectorAll("iframe")].find((f) => f.src.startsWith(origin))
      if (!el) return false
      Object.assign(el.style, { position: "fixed", left: "0", top: "0", width: `${width}px`, height: "640px", zIndex: "2147483647", background: "white" })
      return true
    },
    { origin, width },
  )
  await page.waitForTimeout(800)
  return found
}

/** How far the widget's page scrolls sideways (0: it fits). */
const overflow = (frame) => frame.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth))

/** axe on the widget's frame: the failing violations' ids, and every violation as text. */
async function runAxe(frame) {
  const require = createRequire(import.meta.url)
  // Evaluated through the DevTools protocol, not added as a <script>: a
  // widget's Content Security Policy refuses inline scripts, as it should,
  // and stays in force for the rest of the check.
  if (!(await frame.evaluate(() => Boolean(globalThis.axe)))) await frame.evaluate(readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"))
  const { violations } = await frame.evaluate(() => globalThis.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }))
  return {
    lines: violations.flatMap((v) => [
      `${v.impact}: ${v.id} (${v.nodes.length}): ${v.help}`,
      ...v.nodes.slice(0, 3).map((n) => `  at ${n.target.join(" ")}: ${(n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 240)}`),
    ]),
    failing: failingViolations(violations).map((v) => v.id),
  }
}

/**
 * The keyboard path: Tab from the start of the widget's page through its
 * controls (at most 40 steps, until focus comes back round), then Escape.
 * Returns the controls reached, and whether Tab got stuck in a loop.
 */

/** Whether the widget's page shows a control (a link, a button, a field, a tabindex). */
const hasControl = (frame) =>
  frame.evaluate(() =>
    [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].some((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && !el.disabled
    }),
  )
async function keyboardPath(page, frame) {
  await frame.evaluate(() => {
    document.activeElement?.blur?.()
    window.focus()
  })
  // Each element focused is marked: the walk stops when focus comes back to
  // one already reached (round, or a trap), whatever its label.
  const reached = []
  let trapped = false
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab")
    const here = await frame.evaluate((step) => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      const seen = el.getAttribute("data-e2e-tab")
      if (seen !== null) return { again: Number(seen) }
      el.setAttribute("data-e2e-tab", String(step))
      const name = el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 40) || el.getAttribute("name") || ""
      return { label: `${el.tagName.toLowerCase()}${name ? ` "${name}"` : ""}` }
    }, reached.length)
    if (!here) continue
    if ("again" in here) {
      // The same element again: Tab moves within it (a date field's parts).
      if (here.again === reached.length - 1) continue
      // Back to the first: round. To another one before: stuck in a loop.
      trapped = here.again !== 0
      break
    }
    reached.push(here.label)
  }
  await page.keyboard.press("Escape")
  await frame.evaluate(() => document.querySelectorAll("[data-e2e-tab]").forEach((el) => el.removeAttribute("data-e2e-tab")))
  return { reached, trapped }
}

async function checkWidget({ browser, gristUrl, api, wsId, widgetDir, outDir, timeout, build, axe, themes, strictConsole, standard }) {
  const pkg = JSON.parse(readFileSync(path.join(widgetDir, "package.json"), "utf8"))
  // A scoped name (@grist-widgets/kanban-board) keeps its last part: it names a URL path and a file.
  const name = pkg.name.replace(/^@[^/]+\//, "")
  const result = { widget: name, ok: false, reason: "", console: [], screenshot: null, doc: null }
  if (build) execFileSync("node_modules/.bin/vite", ["build"], { cwd: widgetDir, stdio: "inherit" })
  const dist = path.join(widgetDir, "dist")
  if (!existsSync(path.join(dist, "index.html"))) throw new Error(`${widgetDir}/dist is missing: build it, or pass --build`)

  const { options, from, demo } = await readWidgetExports(widgetDir, { demo: true })
  result.optionsFrom = from
  const server = await serve(dist)
  const origin = `http://127.0.0.1:${server.address().port}`
  // The widget's demo data (src/app/demo.ts) when it has some, sample rows otherwise.
  const { docId, viewId } = await createDocument(api, wsId, name, options, `${origin}/${name}/dev/`, demo)
  result.doc = `${gristUrl}/doc/${docId}/p/${viewId}`

  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  // Every Content Security Policy refusal in the widget's frames, the ones
  // that inherit its policy (srcdoc, blob:) included, as a console error the
  // check counts wherever it comes from.
  await context.addInitScript((widgetOrigin) => {
    const own = location.origin === widgetOrigin || location.protocol === "about:" || location.protocol === "blob:"
    if (!own) return
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`[csp-violation] ${e.effectiveDirective} refused ${e.blockedURI || "inline"} in ${location.href}`)
    })
  }, origin)
  // Widgets load the plugin API from docs.getgrist.com: serve this Grist's own copy, so nothing leaves the machine.
  await context.route("https://docs.getgrist.com/grist-plugin-api.js", async (route) => {
    const r = await fetch(`${gristUrl}/grist-plugin-api.js`)
    await route.fulfill({ status: 200, contentType: "text/javascript", body: await r.text() })
  })
  const uncaught = []
  try {
    await context.request.get(`${gristUrl}/login`)
    const page = await context.newPage()
    page.on("pageerror", (e) => uncaught.push(String(e).slice(0, 300)))
    page.on("console", (m) => {
      if (m.type() === "error" && ((m.location().url ?? "").startsWith(origin) || m.text().startsWith("[csp-violation]"))) {
        result.console.push(m.text().slice(0, 300))
      }
    })
    await page.goto(result.doc)

    const { state, frame } = await waitRendered(page, origin, timeout)
    if (state === "rendered") await page.waitForTimeout(2000) // let late errors surface

    mkdirSync(outDir, { recursive: true })
    result.screenshot = path.join(outDir, `${name}.png`)
    await page.screenshot({ path: result.screenshot })

    let a11y = null
    if (axe && state === "rendered" && frame) {
      const { lines, failing } = await runAxe(frame)
      result.a11y = lines
      if (failing.length) a11y = `accessibility: ${failing.join(", ")}`
    }

    // The standard criteria: narrow and wide, the keyboard path, read-only.
    let standardFailure = null
    if (standard && state === "rendered" && frame) {
      result.standard = []
      // At each width: no overflow, the keyboard path, then axe again.
      for (const width of [320, 1280]) {
        if (!(await pinWidth(page, origin, width))) {
          standardFailure ??= "narrow: the widget's frame wasn't found"
          break
        }
        const shot = path.join(outDir, `${name}-${width}.png`)
        await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: Math.min(width, 1400), height: 640 } })
        const wider = await overflow(frame)
        result.standard.push(`${width} px: ${wider ? `${wider} px wider than the panel` : "fits"} (${shot})`)
        if (wider > 1) standardFailure ??= `narrow: ${wider} px of horizontal overflow at ${width} px`
        const keys = await keyboardPath(page, frame)
        result.standard.push(`keyboard at ${width} px: ${keys.reached.length} controls reached by Tab${keys.trapped ? ", then stuck in a loop" : ""} (${keys.reached.slice(0, 6).join(", ")}${keys.reached.length > 6 ? ", …" : ""})`)
        if (keys.trapped) standardFailure ??= `keyboard: Tab is stuck in a loop at ${width} px`
        else if (keys.reached.length === 0 && (await hasControl(frame))) standardFailure ??= `keyboard: Tab reaches no control at ${width} px`
        if (axe) {
          const after = await runAxe(frame)
          if (after.failing.length) standardFailure ??= `accessibility after the keyboard path at ${width} px: ${after.failing.join(", ")}`
        }
      }

      // Read-only: the same document in view mode.
      const view = await context.newPage()
      const viewUncaught = []
      const viewConsole = []
      view.on("pageerror", (e) => viewUncaught.push(String(e).slice(0, 300)))
      view.on("console", (m) => {
        if (m.type() === "error" && ((m.location().url ?? "").startsWith(origin) || m.text().startsWith("[csp-violation]"))) {
          viewConsole.push(m.text().slice(0, 300))
        }
      })
      await view.goto(result.doc.replace("/p/", "/m/view/p/"))
      const ro = await waitRendered(view, origin, timeout)
      const writes = (options.requiredAccess ?? "read table") === "full"
      const says = ro.frame
        ? await ro.frame.evaluate(() => [...document.querySelectorAll("h2, [role=status]")].some((h) => /Read-only document/.test(h.textContent ?? ""))).catch(() => false)
        : false
      result.standard.push(`read-only: ${ro.state}${writes ? (says ? ", says so" : ", doesn't say so") : ""}`)
      if (ro.state !== "rendered" && !standardFailure) standardFailure = `read-only: ${ro.state}`
      else if (viewUncaught.length && !standardFailure) standardFailure = `read-only: uncaught: ${viewUncaught[0]}`
      else if (strictConsole && viewConsole.length && !standardFailure) standardFailure = `read-only: console error: ${viewConsole[0]}`
      else if (writes && !says && !standardFailure) standardFailure = "read-only: the widget writes and doesn't say it can't"
      await view.close()
    }

    if (themes && state === "rendered") {
      await page.emulateMedia({ colorScheme: "dark" })
      await page.reload()
      const dark = await waitRendered(page, origin, timeout)
      await page.waitForTimeout(1000)
      result.darkScreenshot = path.join(outDir, `${name}-dark.png`)
      await page.screenshot({ path: result.darkScreenshot })
      result.darkApplied = dark.frame
        ? await dark.frame.evaluate(() => document.documentElement.classList.contains("dark")).catch(() => false)
        : false
    }

    if (state !== "rendered") result.reason = state
    else if (uncaught.length) result.reason = `uncaught: ${uncaught[0]}`
    else if (strictConsole && result.console.length) result.reason = `console error: ${result.console[0]}`
    else if (a11y) result.reason = a11y
    else if (standardFailure) result.reason = standardFailure
    else result.ok = true
  } finally {
    await context.close()
    server.close()
  }
  return result
}

// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dirs.length) {
    console.error("Usage: pnpm e2e:grist <widget dir>... [--build] [--axe] [--themes] [--strict-console] [--standard] [--out <dir>] [--grist-url <url>] [--keep] [--timeout <s>]")
    process.exit(2)
  }
  const gristUrl = args.gristUrl ?? (await startGrist({ container: CONTAINER, port: GRIST_PORT, email: EMAIL }))
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
  const results = []
  try {
    const api = gristApi(gristUrl, await apiKey(gristUrl))
    const [ws] = await api("GET", "/api/orgs/current/workspaces")
    for (const widgetDir of args.dirs) {
      try {
        results.push(
          await checkWidget({
            browser,
            gristUrl,
            api,
            wsId: ws.id,
            widgetDir,
            outDir: path.resolve(args.out),
            timeout: args.timeout,
            build: args.build,
            axe: args.axe,
            themes: args.themes,
            strictConsole: args.strictConsole,
            standard: args.standard,
          })
        )
      } catch (e) {
        results.push({ widget: path.basename(widgetDir), ok: false, reason: String(e?.message ?? e) })
      }
    }
  } finally {
    await browser.close()
    if (!args.gristUrl && !args.keep) stopGrist(CONTAINER)
  }

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.widget}${r.ok ? "" : `: ${r.reason}`}`)
    if (r.optionsFrom) console.log(`      Declaration from ${r.optionsFrom}`)
    for (const c of r.console ?? []) console.log(`      console error: ${c}`)
    for (const v of r.a11y ?? []) console.log(`      axe: ${v}`)
    for (const v of r.standard ?? []) console.log(`      ${v}`)
    if (r.screenshot) console.log(`      screenshot: ${r.screenshot}`)
    if (r.darkScreenshot) {
      console.log(`      dark screenshot: ${r.darkScreenshot}${r.darkApplied ? "" : " (Grist did not switch to its dark theme)"}`)
    }
    if (args.keep && r.doc) console.log(`      document: ${r.doc}`)
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import("node:fs")
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Real Grist (${GRIST_IMAGE})\n\n| Widget | Result |\n| --- | --- |\n` +
        results.map((r) => `| ${r.widget} | ${r.ok ? "renders" : `**fails:** ${r.reason}`} |`).join("\n") +
        "\n"
    )
  }
  process.exit(results.every((r) => r.ok) ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
