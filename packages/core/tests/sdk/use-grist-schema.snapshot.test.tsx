/**
 * Snapshot contract for {@link useGristSchema} replica output (via emulator).
 *
 * Stabilizes `generatedAt` / table column order so CI diffs stay readable.
 * Update snapshots only when preset shapes or schema-building behaviour change
 * intentionally: `pnpm --filter grist-widget-sdk test -- -u use-grist-schema.snapshot`
 */

import React, { useEffect, useRef } from "react"
import { describe, expect, it } from "vitest"
import { screen, waitFor } from "@testing-library/react"

import { presets } from "../../src/emulator"
import { renderWithGrist } from "../../src/emulator/testing"
import type { GristDocumentMode, GristReplicaDocument } from "../../src/sdk/types"
import { useGristSchema } from "../../src/sdk/use-grist-schema"

const PRESET_NAMES = ["blank", "todoList", "contacts"] as const
const ROW_MODES: GristDocumentMode[] = ["schema-only", "schema+samples", "schema+data"]

function stableSchemaSnapshot(doc: GristReplicaDocument): GristReplicaDocument {
  const tables = Object.fromEntries(
    Object.keys(doc.tables)
      .sort()
      .map((tableId) => {
        const table = doc.tables[tableId]!
        const columns = table.columns
          ? Object.fromEntries(
              Object.keys(table.columns)
                .sort()
                .map((colId) => [colId, table.columns![colId]!])
            )
          : table.columns
        return [tableId, { ...table, columns }]
      })
  )
  return {
    ...doc,
    generatedAt: "1970-01-01T00:00:00.000Z",
    source: doc.source ?? "vitest-snapshot",
    tables,
  }
}

function SchemaCapture({
  replicaRowMode,
  onDocument,
}: {
  replicaRowMode: GristDocumentMode
  onDocument: (doc: GristReplicaDocument) => void
}) {
  const delivered = useRef(false)
  const schema = useGristSchema({
    replicaRowMode,
    requiredAccess: "read table",
    source: "vitest-snapshot",
  })

  useEffect(() => {
    if (schema.document && !delivered.current) {
      delivered.current = true
      onDocument(schema.document)
    }
  }, [schema.document, onDocument])

  if (schema.error) return <span data-testid="state">error:{schema.error}</span>
  if (schema.loading || !schema.document) return <span data-testid="state">loading</span>
  return <span data-testid="state">ready</span>
}

describe("useGristSchema() replica snapshots", () => {
  for (const presetName of PRESET_NAMES) {
    for (const mode of ROW_MODES) {
      it(`${presetName} — ${mode}`, async () => {
        let captured: GristReplicaDocument | null = null

        const { emulator } = renderWithGrist(
          <SchemaCapture
            replicaRowMode={mode}
            onDocument={(doc) => {
              captured = doc
            }}
          />,
          { emulator: { document: presets[presetName]() } }
        )

        await waitFor(
          () => {
            expect(screen.getByTestId("state")).toHaveTextContent("ready")
            expect(captured).not.toBeNull()
          },
          { timeout: 5000 }
        )
        expect(captured!.mode).toBe(mode)
        expect(stableSchemaSnapshot(captured!)).toMatchSnapshot()
        emulator.dispose()
      })
    }
  }
})
