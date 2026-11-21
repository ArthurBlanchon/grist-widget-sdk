// Grist's plugin API, as every catalog widget's build ships it (ADR 0016):
// one file, next to the widget's page, so a released version needs nothing
// from anywhere else and works at any path, on any host.
//
// The file, in plugin-api/, is grist-static's dist/grist-plugin-api.js, a
// build without eval, committed byte for byte with grist-static's licence:
// a build needs no network and no cache. It is pinned by its sha512, checked
// at every build and on every built widget (`check-widgets --sizes`); a test
// (scripts/widgets/csp.test.mjs) checks it against the npm tarball, itself
// checked against its pinned integrity (scripts/site/grist-static.mjs).
// This pin is the catalog's own: the demo pages' GRIST_STATIC_VERSION
// (create-grist-widget) can move without it.
//
// Moving to a newer copy replaces the file and both constants in one pull
// request, and releases every widget: `pnpm e2e:grist` runs the shipped file
// in a real Grist.

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/** The grist-static version whose plugin API the catalog ships. */
export const PLUGIN_API_GRIST_STATIC = "0.1.6"

/** The sha512 of that version's dist/grist-plugin-api.js. */
export const PLUGIN_API_SHA512 = "sha512-8S94q+WN+pKGTlhrfh5MCaHovu0JbC6HHm0nTKPEC+fzUAijVuLc8u1QryggGuaFZL3BHSzIKqcYY0yyFmTigg=="

/** The file's name, in plugin-api/ and in a built widget, next to its index.html. */
export const PLUGIN_API_FILE = `grist-plugin-api-${PLUGIN_API_GRIST_STATIC}.js`

/** Where the committed copy and grist-static's licence live. */
export const PLUGIN_API_DIR = join(import.meta.dirname, "plugin-api")

/** Problems with a plugin API file's bytes against the pin, or none. */
export function checkPluginApi(bytes) {
  const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`
  return actual === PLUGIN_API_SHA512 ? [] : [`${PLUGIN_API_FILE} is not the pinned file (sha512 ${PLUGIN_API_SHA512})`]
}

/** The pinned plugin API's bytes, and what the licence files say of it; throws if the file isn't the pinned one. */
export function pinnedPluginApi() {
  const bytes = readFileSync(join(PLUGIN_API_DIR, PLUGIN_API_FILE))
  const problems = checkPluginApi(bytes)
  if (problems.length) throw new Error(`${problems[0]}. Refusing to ship it.`)
  return {
    bytes,
    name: "grist-static",
    version: PLUGIN_API_GRIST_STATIC,
    license: "Apache-2.0",
    notice: readFileSync(join(PLUGIN_API_DIR, "LICENSE.txt"), "utf8").trim(),
  }
}
