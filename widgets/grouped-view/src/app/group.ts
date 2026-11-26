/** Grouping and pivoting rows: pure functions, tested through the widget. */

export type Aggregate = "sum" | "average" | "min" | "max"
export const AGGREGATES: readonly Aggregate[] = ["sum", "average", "min", "max"]

/** A row as the widget reads it: its id, the values it falls under, and its number. */
export type Item = { id: number; groups: string[]; across: string[]; value: number | null; label: string }

/** The key of a blank cell: its group is listed last. */
export const BLANK = ""

/** A cell as the keys it is grouped under: a list cell counts under each of its values. */
export function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    // Decoded, as mapped records give it: a first "L" is a value (#133).
    const keys = [...new Set(value.map(keyOf).filter((k) => k !== BLANK))]
    return keys.length ? keys : [BLANK]
  }
  return [keyOf(value)]
}

function keyOf(value: unknown): string {
  if (value === null || value === undefined) return BLANK
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? BLANK : value.toISOString().slice(0, 10)
  if (typeof value === "object") return JSON.stringify(value)
  return String(value).trim()
}

/** A number from a cell, or null when it holds none. */
export function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

/** Keys in order: numbers by value, text alphabetically, the blank one last. */
export function sortKeys(keys: Iterable<string>): string[] {
  return [...new Set(keys)].sort((a, b) => (a === BLANK ? 1 : b === BLANK ? -1 : collator.compare(a, b)))
}

/** The aggregate of the numbers, or null when there are none. */
export function aggregate(values: readonly (number | null)[], fn: Aggregate): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  switch (fn) {
    case "sum":
      return nums.reduce((a, b) => a + b, 0)
    case "average":
      return nums.reduce((a, b) => a + b, 0) / nums.length
    case "min":
      return Math.min(...nums)
    case "max":
      return Math.max(...nums)
  }
}

export type Group = { key: string; items: Item[] }

export function groupItems(items: readonly Item[]): Group[] {
  const byKey = new Map<string, Item[]>()
  for (const item of items) for (const key of item.groups) byKey.set(key, [...(byKey.get(key) ?? []), item])
  return sortKeys(byKey.keys()).map((key) => ({ key, items: byKey.get(key)! }))
}

export type Pivot = {
  rows: string[]
  columns: string[]
  /** The rows of each cell, under `row\u0000column`. */
  cell: (row: string, column: string) => Item[]
  rowItems: (row: string) => Item[]
  columnItems: (column: string) => Item[]
  all: Item[]
}

export function pivotItems(items: readonly Item[]): Pivot {
  const cells = new Map<string, Item[]>()
  const rows = new Map<string, Set<Item>>()
  const columns = new Map<string, Set<Item>>()
  const add = <K>(map: Map<K, Set<Item>>, key: K, item: Item) => map.set(key, (map.get(key) ?? new Set()).add(item))
  for (const item of items) {
    for (const r of item.groups) {
      add(rows, r, item)
      for (const c of item.across) {
        const k = `${r}\u0000${c}`
        cells.set(k, [...(cells.get(k) ?? []), item])
        add(columns, c, item)
      }
    }
  }
  return {
    rows: sortKeys(rows.keys()),
    columns: sortKeys(columns.keys()),
    cell: (r, c) => cells.get(`${r}\u0000${c}`) ?? [],
    rowItems: (r) => [...(rows.get(r) ?? [])],
    columnItems: (c) => [...(columns.get(c) ?? [])],
    all: [...items],
  }
}
