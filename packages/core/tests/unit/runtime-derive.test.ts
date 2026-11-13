import { describe, expect, it } from "vitest"

import { deriveColumnMappingStatus, deriveError, deriveStatus, mapBackPatch } from "../../src/sdk/runtime/derive"
import { initialRuntimeState, type GristRuntimeState } from "../../src/sdk/runtime/runtime"

const state = (patch: Partial<GristRuntimeState>): GristRuntimeState => ({ ...initialRuntimeState({ requiredAccess: "full" }), ...patch })

describe("deriveStatus / deriveError", () => {
  it("maps the connection, and refuses a widget Grist grants less access than declared", () => {
    expect(deriveStatus(state({}))).toBe("booting")
    expect(deriveStatus(state({ connection: "not-embedded" }))).toBe("unavailable")
    expect(deriveStatus(state({ connection: "unavailable" }))).toBe("unavailable")
    expect(deriveStatus(state({ connection: "error", connectionError: "boom" }))).toBe("error")
    expect(deriveError(state({ connection: "error", connectionError: "boom" }))).toBe("boom")
    expect(deriveStatus(state({ connection: "ready" }))).toBe("ready")
    expect(deriveStatus(state({ connection: "ready", grantedAccess: "full" }))).toBe("ready")
    expect(deriveStatus(state({ connection: "ready", grantedAccess: "read table" }))).toBe("error")
    expect(deriveError(state({ connection: "ready", grantedAccess: "read table" }))).toMatch(/needs "Full document access"/)
  })
})

describe("deriveColumnMappingStatus", () => {
  it("is ok without declared columns, pending until reported, then validated", () => {
    expect(deriveColumnMappingStatus(undefined, null)).toMatchObject({ ok: true, pending: false })
    expect(deriveColumnMappingStatus(["A"], null)).toMatchObject({ ok: true, pending: true })
    expect(deriveColumnMappingStatus(["A"], {})).toMatchObject({ ok: false, missing: ["A"] })
    expect(deriveColumnMappingStatus([{ name: "A", optional: true }], {})).toMatchObject({ ok: true })
  })
})

describe("mapBackPatch", () => {
  it("writes mapped names to their columns, passes unmapped ones through, skips multi-column ones", () => {
    expect(mapBackPatch({ Title: "y", Other: 1, Tags: ["z"], Gone: undefined }, { Title: "title", Tags: ["t1"] })).toEqual({
      fields: { title: "y", Other: 1 },
      skipped: ["Tags"],
    })
  })
})
