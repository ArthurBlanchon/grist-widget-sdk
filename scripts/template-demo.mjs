// The template's demo page (templates/grist-widget-template-vite/public/demo/):
// its document, generated from the template's widget declaration with a few
// tasks, and the page that opens it in Grist running in the browser.
//
//   node scripts/template-demo.mjs build   regenerate it (needs Docker)
//   node scripts/template-demo.mjs check   fail if it is missing or stale
//
// Every scaffold gets it, so a new widget opens in real Grist from the first
// `pnpm dev` (http://localhost:5173/demo/, the dev server's widget, edits
// reloading in place) with no Docker. public/ is the widget's own: `upgrade`
// never touches it, and `pnpm demo --save` regenerates it once the widget's
// columns change. scripts/template-demo.json records a hash of what the
// document was generated from, so `check` (CI) knows when the template's
// declaration changed and the document must be regenerated.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const TEMPLATE = join(repoRoot, "templates/grist-widget-template-vite")
const DEMO_DIR = join(TEMPLATE, "public/demo")
const RECORD = join(repoRoot, "scripts/template-demo.json")

const TASKS = [
  { Title: "Write the release notes", Done: true },
  { Title: "Review the pull request", Done: false },
  { Title: "Book the team offsite", Done: false },
  { Title: "Renew the domain name", Done: true },
]

const cli = (file) => import(join(repoRoot, "packages/create-grist-widget/src", file))

/** What the document is generated from: the declaration's access, columns and title, and the rows. */
export function demoHash({ options, metadata }) {
  const source = { requiredAccess: options.requiredAccess ?? null, columns: options.columns ?? [], title: metadata?.title ?? null, rows: TASKS }
  return createHash("sha256").update(JSON.stringify(source)).digest("hex").slice(0, 16)
}

async function declaration() {
  const { readWidgetExports } = await cli("grist-local.mjs")
  return readWidgetExports(TEMPLATE)
}

async function build() {
  const { withLocalGrist } = await cli("demo.mjs")
  const { createDocument, firstWorkspace, gristApi } = await cli("grist-local.mjs")
  const { DEMO_URL_PLACEHOLDER, demoPageHtml } = await cli("demo-page.mjs")
  const found = await declaration()
  const title = found.metadata?.title ?? "Grist Widget Template"
  const bytes = await withLocalGrist(
    async ({ gristUrl, key }) => {
      const api = gristApi(gristUrl, key)
      const { docId } = await createDocument(api, await firstWorkspace(api), title, found.options, DEMO_URL_PLACEHOLDER)
      const apply = (actions) => api("POST", `/api/docs/${docId}/apply`, actions)
      const { records } = await api("GET", `/api/docs/${docId}/tables/Data/records`)
      await apply([
        ["RemoveTable", "Table1"],
        ["BulkRemoveRecord", "Data", records.map((r) => r.id)],
      ])
      await api("POST", `/api/docs/${docId}/tables/Data/records`, { records: TASKS.map((fields) => ({ fields })) })
      await apply([["RenameTable", "Data", "Tasks"]])
      const res = await fetch(`${gristUrl}/api/docs/${docId}/download?nohistory=true`, { headers: { Authorization: `Bearer ${key}` } })
      if (!res.ok) throw new Error(`template-demo: downloading the document failed (${res.status})`)
      return Buffer.from(await res.arrayBuffer())
    },
    { gristPort: 8694, container: "grist-widget-template-demo" }
  )
  mkdirSync(DEMO_DIR, { recursive: true })
  writeFileSync(join(DEMO_DIR, "demo.grist"), bytes)
  writeFileSync(join(DEMO_DIR, "index.html"), demoPageHtml({ title }))
  writeFileSync(RECORD, `${JSON.stringify({ hash: demoHash(found) }, null, 2)}\n`)
  console.log(`template-demo: wrote ${DEMO_DIR} (${bytes.length} bytes)`)
}

async function check() {
  const problems = []
  for (const file of ["demo.grist", "index.html"]) if (!existsSync(join(DEMO_DIR, file))) problems.push(`public/demo/${file} is missing`)
  const recorded = existsSync(RECORD) ? JSON.parse(readFileSync(RECORD, "utf8")).hash : null
  if (recorded !== demoHash(await declaration())) problems.push("the template's declaration (access, columns or title) changed since the document was generated")
  if (problems.length) {
    console.error(`template-demo: ${problems.join("; ")}.`)
    console.error("Run `node scripts/template-demo.mjs build` (needs Docker) and commit the template's public/demo/ and scripts/template-demo.json.")
    process.exit(1)
  }
  console.log("template-demo: the template's demo document is current")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2]
  if (cmd === "build") await build()
  else if (cmd === "check") await check()
  else {
    console.error("Usage: node scripts/template-demo.mjs build|check")
    process.exit(2)
  }
  process.exit(0)
}
