#!/usr/bin/env node
// Writes what typed reads give back into a real Grist, encoded by the SDK's
// encodeGristCell (what mapBack does), and checks Grist stores each value as
// a value, not as an error cell. The plugin API's TableOperations pass values
// to BulkUpdateRecord as given, with parseStrings; the REST /apply call below
// does the same. Checked in Grist 1.7.22: a bare list is stored as
// ["E", "KeyError"].
//
//   pnpm --filter grist-widget-sdk build
//   node scripts/real-widgets/write-round-trip.mjs
//
// Needs Docker. Run by real-widgets.yml weekly and on demand, with the pinned
// Grist image create-grist-widget uses.

import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const { encodeGristCell } = await import(pathToFileURL(path.join(root, "packages/core/dist/index.js")).href)
const { apiKey, firstWorkspace, gristApi, startGrist, stopGrist, GRIST_IMAGE } = await import(
  pathToFileURL(path.join(root, "packages/create-grist-widget/src/grist-local.mjs")).href
)

const CONTAINER = "grist-write-round-trip"
const PORT = 8597

/** A Reference as the plugin API decodes it in a read. */
class Reference {
  constructor(tableId, rowId) {
    this.tableId = tableId
    this.rowId = rowId
  }
}

// [column, declared type, value as a typed read gives it, what Grist must store]
const CASES = [
  ["Tags", "ChoiceList", ["home", "work"], ["L", "home", "work"]],
  ["Links", "RefList:People", [1, 2], ["L", 1, 2]],
  ["LinksDecoded", "RefList:People", [new Reference("People", 2)], ["L", 2]],
  ["Owner", "Ref:People", new Reference("People", 2), 2],
  ["Due", "Date", new Date(Date.UTC(2026, 10, 12)), 1_794_441_600],
  ["At", "DateTime:UTC", new Date(Date.UTC(2026, 10, 12, 9, 30)), 1_794_475_800],
  ["Count", "Numeric", 4.5, 4.5],
  ["Done", "Bool", true, true],
]

const url = await startGrist({ container: CONTAINER, port: PORT })
let failures = 0
try {
  const api = gristApi(url, await apiKey(url))
  const docId = await api("POST", `/api/workspaces/${await firstWorkspace(api)}/docs`, { name: "write round trip" })
  const apply = (actions) => api("POST", `/api/docs/${docId}/apply?parse_strings=true`, actions)
  await apply([
    ["AddTable", "People", [{ id: "Name", type: "Text" }]],
    [
      "AddTable",
      "T",
      CASES.map(([id, type]) => ({
        id,
        type,
        ...(type === "ChoiceList" ? { widgetOptions: JSON.stringify({ choices: ["home", "work"] }) } : {}),
      })),
    ],
    ["BulkAddRecord", "People", [null, null], { Name: ["Ada", "Grace"] }],
    ["AddRecord", "T", null, {}],
  ])
  for (const [col, type, read, expected] of CASES) {
    // JSON, as the plugin API's postMessage + websocket does to a value (a Date crosses as its ISO string).
    const sent = JSON.parse(JSON.stringify(encodeGristCell(type, read)))
    await apply([["UpdateRecord", "T", 1, { [col]: sent }]])
    const { records } = await api("GET", `/api/docs/${docId}/tables/T/records`)
    const stored = records[0].fields[col]
    const ok = JSON.stringify(stored) === JSON.stringify(expected)
    if (!ok) failures++
    console.log(`${ok ? "ok  " : "FAIL"} ${col} (${type}): sent ${JSON.stringify(sent)}, stored ${JSON.stringify(stored)}`)
  }
} finally {
  stopGrist(CONTAINER)
}
console.log(failures ? `write round trip: ${failures} failure(s) in ${GRIST_IMAGE}` : `write round trip: every type stored as written (${GRIST_IMAGE})`)
process.exit(failures ? 1 : 0)
