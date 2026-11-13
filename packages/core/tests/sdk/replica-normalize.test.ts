import { describe, expect, it } from "vitest"

import type { GristReplicaDocument } from "../../src/sdk/replica-document"
import {
  buildReplicaJsonPayload,
  normalizeReplicaDocumentInput,
  normalizeReplicaTableInput,
} from "../../src/sdk/helpers/replica-normalize"

describe("normalizeReplicaTableInput", () => {
  it("defaults missing rows to []", () => {
    const t = normalizeReplicaTableInput({ columns: { a: { type: "Text" } } })
    expect(t.rows).toEqual([])
  })

  it("preserves existing rows", () => {
    const t = normalizeReplicaTableInput({ rows: [{ id: 1, x: 1 }] })
    expect(t.rows).toEqual([{ id: 1, x: 1 }])
  })
})

describe("normalizeReplicaDocumentInput", () => {
  it("normalizes every table", () => {
    const doc: GristReplicaDocument = {
      generatedAt: "t",
      tables: {
        A: { rowCount: 0 },
        B: { rows: [{ id: 2 }] },
      },
    }
    const n = normalizeReplicaDocumentInput(doc)
    expect(n.tables.A?.rows).toEqual([])
    expect(n.tables.B?.rows).toEqual([{ id: 2 }])
  })
})

describe("buildReplicaJsonPayload", () => {
  const base: GristReplicaDocument = {
    generatedAt: "t",
    source: "test",
    tables: {
      T: {
        rows: [
          { id: 1, n: 1 },
          { id: 2, n: 2 },
          { id: 3, n: 3 },
        ],
      },
    },
  }

  it("strips rows when includeRows is none", () => {
    const out = buildReplicaJsonPayload(base, { includeRows: "none" })
    expect(out.tables.T?.rows).toBeUndefined()
    expect(out.source).toBe("test")
  })

  it("caps rows for samples", () => {
    const out = buildReplicaJsonPayload(base, { includeRows: "samples", sampleRowLimit: 2 })
    expect(out.tables.T?.rows).toEqual([
      { id: 1, n: 1 },
      { id: 2, n: 2 },
    ])
  })

  it("passes through for full", () => {
    const out = buildReplicaJsonPayload(base, { includeRows: "full" })
    expect(out.tables.T?.rows).toEqual(base.tables.T?.rows)
  })
})
