/** The board's columns: the saved order first, then any other status in the order rows use it. */
export function boardColumns(order: readonly string[], statuses: readonly string[]): string[] {
  const seen = new Set<string>()
  const columns: string[] = []
  for (const status of [...order, ...statuses]) {
    if (seen.has(status)) continue
    seen.add(status)
    columns.push(status)
  }
  return columns
}

/** The column order saved in the widget's options, or none. */
export function readOrder(options: Record<string, unknown> | null): string[] {
  const saved = options?.columns
  return Array.isArray(saved) ? saved.filter((c): c is string => typeof c === "string") : []
}

/** `columns` with `status` moved by `delta` places, kept within the board. */
export function moveColumn(columns: readonly string[], status: string, delta: -1 | 1): string[] {
  const from = columns.indexOf(status)
  const to = from + delta
  if (from < 0 || to < 0 || to >= columns.length) return [...columns]
  const next = [...columns]
  next.splice(from, 1)
  next.splice(to, 0, status)
  return next
}

/** The column next to `status` in direction `delta`, or null at the edge. */
export function neighbour(columns: readonly string[], status: string, delta: -1 | 1): string | null {
  const i = columns.indexOf(status) + delta
  return i >= 0 && i < columns.length ? columns[i] : null
}
