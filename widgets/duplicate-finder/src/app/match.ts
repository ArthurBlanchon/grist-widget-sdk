import { fromStored } from "@shared/stored"

/** Grouping rows that are the same on their keys, exactly or approximately. */

export type Mode = "exact" | "close"

/** A value as it is compared: no case, accents, punctuation or extra spaces. */
export function normalize(value: unknown): string {
  if (value === null || value === undefined) return ""
  // Stored form (fetchRows(tableId)): only the leading tag goes, a choice "L" stays (#133).
  const text = Array.isArray(value) ? (fromStored(value) as unknown[]).join(" ") : value instanceof Date ? value.toISOString() : String(value)
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

/** Jaro-Winkler similarity, 0 (nothing alike) to 1 (the same). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aHit = new Array<boolean>(a.length).fill(false)
  const bHit = new Array<boolean>(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (bHit[j] || a[i] !== b[j]) continue
      aHit[i] = bHit[j] = true
      matches++
      break
    }
  }
  if (!matches) return 0
  let k = 0
  let swaps = 0
  for (let i = 0; i < a.length; i++) {
    if (!aHit[i]) continue
    while (!bHit[k]) k++
    if (a[i] !== b[k]) swaps++
    k++
  }
  const jaro = (matches / a.length + matches / b.length + (matches - swaps / 2) / matches) / 3
  let prefix = 0
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++
  return jaro + prefix * 0.1 * (1 - jaro)
}

/** How alike two keys must be, in approximate mode. */
export const CLOSE = 0.92
/** In approximate mode, each key is compared with this many neighbours in sorted order. */
const WINDOW = 8

export type Row = { id: number } & Record<string, unknown>

/**
 * The groups of two or more rows that are the same on `keys`, each in the
 * rows' order. Exact mode groups equal normalised keys; approximate mode
 * also joins keys alike enough, comparing each with its neighbours in
 * sorted order, and in the order of the reversed key (a typo at the start).
 */
export function findGroups(rows: readonly Row[], keys: readonly string[], mode: Mode): Row[][] {
  const keyed = rows.map((row) => ({ row, key: keys.map((k) => normalize(row[k])).join(" | ") })).filter((x) => x.key.replace(/[ |]/g, ""))
  const parent = keyed.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)))
  const join = (i: number, j: number) => {
    const a = root(i)
    const b = root(j)
    if (a !== b) parent[Math.max(a, b)] = Math.min(a, b)
  }

  const byKey = new Map<string, number>()
  keyed.forEach((x, i) => {
    const first = byKey.get(x.key)
    if (first === undefined) byKey.set(x.key, i)
    else join(first, i)
  })

  if (mode === "close") {
    const distinct = [...byKey]
    for (const order of [(s: string) => s, (s: string) => [...s].reverse().join("")]) {
      const sorted = distinct.map(([key, i]) => ({ sort: order(key), key, i })).sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0))
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < Math.min(sorted.length, i + 1 + WINDOW); j++) {
          if (similarity(sorted[i]!.key, sorted[j]!.key) >= CLOSE) join(sorted[i]!.i, sorted[j]!.i)
        }
      }
    }
  }

  const groups = new Map<number, Row[]>()
  keyed.forEach((x, i) => {
    const r = root(i)
    const list = groups.get(r)
    if (list) list.push(x.row)
    else groups.set(r, [x.row])
  })
  return [...groups.values()].filter((g) => g.length > 1)
}

/** A cell with nothing in it: blank text, no reference, an empty list. */
export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true
  if (Array.isArray(value)) return (fromStored(value) as unknown[]).length === 0
  return false
}

/** The row to keep by default: the most filled cells, then the first. */
export function defaultKeep(group: readonly Row[]): number {
  let best = group[0]!
  let bestCount = -1
  for (const row of group) {
    const count = Object.entries(row).filter(([k, v]) => k !== "id" && !isBlank(v)).length
    if (count > bestCount) {
      best = row
      bestCount = count
    }
  }
  return best.id
}
