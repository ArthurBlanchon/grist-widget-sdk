#!/usr/bin/env node
// The widgets the "Real widgets" workflow checks: the reference widgets of
// the awesome-grist-widgets registry (entries with "reference": true), plus
// pending.json, reference widgets not registered yet (the six SDK widgets
// until their release, plan R2). Prints them as a JSON array of "owner/repo".
//
//   node scripts/real-widgets/list-widgets.mjs          # fetches the registry
//   REGISTRY_FILE=../awesome-grist-widgets/widgets.json node ...   # a local copy
//
// The workflow runs these repositories' code, so each name is checked
// strictly before it reaches a shell, and an empty list is an error rather
// than a green run that checked nothing.

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const REGISTRY_URL =
  "https://raw.githubusercontent.com/ArthurBlanchon/awesome-grist-widgets/main/widgets.json"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_URL = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+?)\/?$/
const REPO_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/

/** "owner/repo" of each registry entry marked `"reference": true`. */
export function referenceRepos(registry) {
  if (!Array.isArray(registry)) throw new Error("the registry's widgets.json is not an array")
  return registry
    .filter((entry) => entry && entry.reference === true)
    .map((entry) => {
      const match = REPO_URL.exec(String(entry.repoUrl ?? ""))
      if (!match || match[2] === "." || match[2] === "..") {
        throw new Error(`reference widget with an unexpected repoUrl: ${JSON.stringify(entry.repoUrl)}`)
      }
      return `${match[1]}/${match[2]}`
    })
}

/** The registry's reference widgets, then the pending ones, without duplicates. */
export function widgetList(registry, pending) {
  for (const name of pending) {
    if (typeof name !== "string" || !REPO_NAME.test(name)) {
      throw new Error(`pending.json: unexpected repository name ${JSON.stringify(name)}`)
    }
  }
  const seen = new Map()
  for (const name of [...referenceRepos(registry), ...pending]) {
    const key = name.toLowerCase()
    if (!seen.has(key)) seen.set(key, name)
  }
  const list = [...seen.values()]
  if (list.length === 0) throw new Error("no widget to check: the registry has no reference widget, and pending.json is empty")
  return list
}

async function loadRegistry() {
  if (process.env.REGISTRY_FILE) return JSON.parse(readFileSync(process.env.REGISTRY_FILE, "utf8"))
  const response = await fetch(REGISTRY_URL)
  if (!response.ok) throw new Error(`${REGISTRY_URL}: HTTP ${response.status}`)
  return response.json()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pending = JSON.parse(readFileSync(path.join(HERE, "pending.json"), "utf8"))
  console.log(JSON.stringify(widgetList(await loadRegistry(), pending)))
}
