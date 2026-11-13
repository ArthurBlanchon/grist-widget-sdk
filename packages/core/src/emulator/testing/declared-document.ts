/**
 * A test document from a widget's declared columns: one table, `Table1`,
 * with a column per declared column (typed after the first type it accepts)
 * and the given rows, each value stored as Grist stores it; and the mappings
 * that map every declared column to its namesake. Shared by
 * `smokeTestWidget` and `renderWithGrist({ widget })`.
 */

import { encodeGristCell } from "../../sdk/runtime/cells"
import type { GristColumnToMap, GristReplicaDocument, GristWidgetColumnMap, UseGristOptions } from "../../sdk"

export type Column = { name: string; type: string; declared: string | undefined; allowMultiple: boolean }

export function declaredColumns(options: UseGristOptions): Column[] {
  return (options.columns ?? []).map((column: string | GristColumnToMap) =>
    typeof column === "string"
      ? { name: column, type: "Any", declared: undefined, allowMultiple: false }
      : { name: column.name, type: firstType(column.type), declared: column.type, allowMultiple: column.allowMultiple === true }
  )
}

/** The first Grist type a column accepts: `"Text,Ref,Choice"` gives `"Text"`. */
function firstType(type: string | undefined): string {
  return (type ?? "Any").split(",")[0].trim() || "Any"
}

export function mapEveryColumn(columns: Column[]): GristWidgetColumnMap {
  return Object.fromEntries(columns.map((c) => [c.name, c.allowMultiple ? [c.name] : c.name]))
}

/**
 * One table with a column per declared column, and `rows` (under the declared
 * names, as typed reads give them: a `Date`, a `string[]`…), or one row of
 * sample values.
 */
export function declaredDocument(columns: Column[], rows?: ReadonlyArray<Record<string, unknown>>): GristReplicaDocument {
  const given = rows ?? [Object.fromEntries(columns.map((c) => [c.name, sampleValue(c.type)]))]
  return {
    generatedAt: "1970-01-01T00:00:00.000Z",
    docName: "Test document",
    mode: "schema+data",
    tables: {
      Table1: {
        columns: Object.fromEntries(columns.map((c) => [c.name, { type: c.type }])),
        rows: given.map((row, i) => ({
          id: typeof row.id === "number" ? row.id : i + 1,
          ...Object.fromEntries(columns.map((c) => [c.name, encodeGristCell(c.declared, row[c.name] ?? null)])),
        })),
      },
    },
  }
}

function sampleValue(type: string): unknown {
  switch (type) {
    case "Numeric":
    case "Int":
      return 42
    case "Bool":
      return true
    case "Date":
    case "DateTime":
      return 1767225600 // 2026-01-01, as Grist stores it: epoch seconds
    default:
      return "Sample"
  }
}
