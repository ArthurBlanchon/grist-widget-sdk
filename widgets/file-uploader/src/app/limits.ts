/** The files the widget takes: types (as an `accept` list) and a size limit, from its options. */
export type Limits = { accept: string; maxSizeMB: number }

export const DEFAULT_MAX_MB = 25

export function readLimits(options: Record<string, unknown> | null | undefined): Limits {
  const accept = typeof options?.accept === "string" ? options.accept : ""
  const max = typeof options?.maxSizeMB === "number" && options.maxSizeMB > 0 ? options.maxSizeMB : DEFAULT_MAX_MB
  return { accept, maxSizeMB: max }
}

/** Whether `file` matches an `accept` list such as `image/*, .pdf, application/zip`. */
export function accepts(file: { name: string; type: string }, accept: string): boolean {
  const rules = accept
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean)
  if (rules.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some((r) => (r.startsWith(".") ? name.endsWith(r) : r.endsWith("/*") ? type.startsWith(r.slice(0, -1)) : type === r))
}

export type Refusal = { name: string; reason: "size" | "type" }

/** Why `file` is refused under `limits`, or null when it is taken. */
export function refusal(file: { name: string; type: string; size: number }, limits: Limits): Refusal | null {
  if (!accepts(file, limits.accept)) return { name: file.name, reason: "type" }
  if (file.size > limits.maxSizeMB * 1024 * 1024) return { name: file.name, reason: "size" }
  return null
}
