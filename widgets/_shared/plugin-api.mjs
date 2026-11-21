// Grist's plugin API, as every catalog widget's build ships it (ADR 0016):
// one file, next to the widget's page, so a released version needs nothing
// from anywhere else and works at any path, on any host, for good.
//
// The file is grist-static's grist-plugin-api.js, a build without eval,
// pinned here by version and by its own hash: the tarball's integrity is
// checked when it is fetched (scripts/site/grist-static.mjs), and the file's
// hash each time a widget is built and each time `check-widgets --sizes`
// reads a build. This pin is the catalog's own: the demo pages'
// GRIST_STATIC_VERSION (create-grist-widget) can move without it.
//
// Moving to a newer copy changes both constants in one pull request, and
// releases every widget: `pnpm e2e:grist` runs the shipped file in a real
// Grist.

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { gristStaticPackage } from "../../scripts/site/grist-static.mjs"

/** The grist-static version whose plugin API the catalog ships. */
export const PLUGIN_API_GRIST_STATIC = "0.1.6"

/** The sha512 of that version's dist/grist-plugin-api.js. */
export const PLUGIN_API_SHA512 = "sha512-8S94q+WN+pKGTlhrfh5MCaHovu0JbC6HHm0nTKPEC+fzUAijVuLc8u1QryggGuaFZL3BHSzIKqcYY0yyFmTigg=="

/** The file's name in a built widget, next to its index.html. */
export const PLUGIN_API_FILE = `grist-plugin-api-${PLUGIN_API_GRIST_STATIC}.js`

/** Problems with a plugin API file's bytes against the pin, or none. */
export function checkPluginApi(bytes) {
  const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`
  return actual === PLUGIN_API_SHA512 ? [] : [`${PLUGIN_API_FILE}: sha512 ${actual}, pinned ${PLUGIN_API_SHA512}`]
}

/** The pinned plugin API's bytes and grist-static's licence text; throws if the file isn't the pinned one. */
export async function pinnedPluginApi(options) {
  const pkg = await gristStaticPackage(PLUGIN_API_GRIST_STATIC, options)
  const bytes = readFileSync(join(pkg, "dist", "grist-plugin-api.js"))
  const problems = checkPluginApi(bytes)
  if (problems.length) throw new Error(`${problems[0]}. Refusing to ship it.`)
  const meta = JSON.parse(readFileSync(join(pkg, "package.json"), "utf8"))
  return { bytes, name: "grist-static", version: String(meta.version), license: String(meta.license), notice: readFileSync(join(pkg, "LICENSE.txt"), "utf8").trim() }
}
