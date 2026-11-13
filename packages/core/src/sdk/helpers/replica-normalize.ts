import type { GristReplicaDocument, GristReplicaRow, GristReplicaTable } from "../replica-document"

/**
 * Ensure `rows` is a concrete array for emulator / merge logic.
 * Call at host boundaries (`createDocument`, tests); JSON may still omit `rows` for schema-only.
 */
export function normalizeReplicaTableInput<T extends GristReplicaTable>(table: T): T & { rows: GristReplicaRow[] } {
  return { ...table, rows: table.rows ?? [] }
}

/** Apply {@link normalizeReplicaTableInput} to every table; shallow-copies the document shell. */
export function normalizeReplicaDocumentInput<T extends GristReplicaDocument>(doc: T): T {
  return {
    ...doc,
    tables: Object.fromEntries(
      Object.entries(doc.tables).map(([tableId, t]) => [tableId, normalizeReplicaTableInput(t)])
    ),
  } as T
}

/** How row arrays appear in serialized replica JSON from {@link buildReplicaJsonPayload}. */
export type ReplicaJsonIncludeRows = "none" | "samples" | "full"

/**
 * Clone a replica document for JSON output: strip rows, cap to first N, or pass through.
 * Does not mutate the source document.
 */
export function buildReplicaJsonPayload(
  doc: GristReplicaDocument,
  options: { includeRows: ReplicaJsonIncludeRows; sampleRowLimit?: number }
): GristReplicaDocument {
  const limit = options.sampleRowLimit ?? 10
  const tables = Object.fromEntries(
    Object.entries(doc.tables).map(([tid, t]) => {
      if (options.includeRows === "none") {
        const { rows: _r, ...rest } = t
        return [tid, rest]
      }
      if (options.includeRows === "samples") {
        const r = t.rows ?? []
        return [tid, { ...t, rows: r.slice(0, limit) }]
      }
      return [tid, { ...t, rows: t.rows }]
    })
  ) as GristReplicaDocument["tables"]
  return { ...doc, tables }
}
