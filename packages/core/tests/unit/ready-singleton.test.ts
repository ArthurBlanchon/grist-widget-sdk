/**
 * ensureGristReady() — page-level dedupe of the real `grist.ready()` call.
 *
 * Re-init should happen whenever a later caller asks for strictly more than
 * what's already cached: a higher access level, or a column name the cached
 * payload didn't declare. This is what lets a bare fallback caller (e.g. a
 * status chip with no declared columns/access) avoid permanently sticking a
 * widget's real, richer requirements to the host just by winning the race
 * to call `ensureGristReady` first.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ensureGristReady,
  gristColumnsToMap,
  resetGristReady,
} from "../../src/sdk/runtime/ready"

describe("ensureGristReady", () => {
  let readyMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    readyMock = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as unknown as { grist: { ready: typeof readyMock } }).grist = {
      ready: readyMock,
    }
  })

  afterEach(() => {
    resetGristReady()
    delete (globalThis as { grist?: unknown }).grist
  })

  it("calls grist.ready once for repeated calls with the same access/columns", async () => {
    await ensureGristReady({ requiredAccess: "read table", columns: [] })
    await ensureGristReady({ requiredAccess: "read table", columns: [] })
    expect(readyMock).toHaveBeenCalledTimes(1)
  })

  it("re-inits when access widens", async () => {
    await ensureGristReady({ requiredAccess: "read table", columns: [] })
    await ensureGristReady({ requiredAccess: "full", columns: [] })
    expect(readyMock).toHaveBeenCalledTimes(2)
    expect(readyMock).toHaveBeenLastCalledWith({ requiredAccess: "full", columns: [] })
  })

  it("does NOT re-init when access narrows or stays equal with no new columns", async () => {
    await ensureGristReady({ requiredAccess: "full", columns: [] })
    await ensureGristReady({ requiredAccess: "read table", columns: [] })
    expect(readyMock).toHaveBeenCalledTimes(1)
  })

  it("re-inits when a previously-undeclared column is requested, even at the same access level", async () => {
    await ensureGristReady({ requiredAccess: "read table", columns: [] })
    await ensureGristReady({
      requiredAccess: "read table",
      columns: [{ name: "Group_name" }],
    })
    expect(readyMock).toHaveBeenCalledTimes(2)
    expect(readyMock).toHaveBeenLastCalledWith({
      requiredAccess: "read table",
      columns: [{ name: "Group_name" }],
    })
  })

  it("treats string column entries the same as { name } objects", async () => {
    await ensureGristReady({ requiredAccess: "read table", columns: ["Group_name"] })
    await ensureGristReady({
      requiredAccess: "read table",
      columns: [{ name: "Group_name" }],
    })
    expect(readyMock).toHaveBeenCalledTimes(1)
  })

  it("does not re-init once all requested columns are already covered", async () => {
    await ensureGristReady({
      requiredAccess: "read table",
      columns: [{ name: "Group_name" }, { name: "Event_name" }],
    })
    await ensureGristReady({
      requiredAccess: "read table",
      columns: [{ name: "Group_name" }],
    })
    expect(readyMock).toHaveBeenCalledTimes(1)
  })
})

describe("the declaration Grist reads (grist.ready's columns)", () => {
  afterEach(() => {
    resetGristReady()
    delete (globalThis as { grist?: unknown }).grist
  })

  it("hands Grist each declared type's base: Grist maps a column whose base type is declared", () => {
    expect(
      gristColumnsToMap([
        "Plain",
        { name: "Owner", type: "Ref:People" },
        { name: "Tags", type: "RefList:Tags", allowMultiple: true },
        { name: "Label", type: "Text, Ref:People" },
        { name: "At", type: "DateTime:Europe/Paris", optional: true },
        { name: "Count", type: "Numeric" },
        { name: "Anything" },
      ])
    ).toEqual([
      "Plain",
      { name: "Owner", type: "Ref" },
      { name: "Tags", type: "RefList", allowMultiple: true },
      { name: "Label", type: "Text,Ref" },
      { name: "At", type: "DateTime", optional: true },
      { name: "Count", type: "Numeric" },
      { name: "Anything" },
    ])
  })

  it("is what ensureGristReady sends", async () => {
    const ready = vi.fn().mockResolvedValue(undefined)
    ;(globalThis as unknown as { grist: { ready: typeof ready } }).grist = { ready }
    await ensureGristReady({ requiredAccess: "read table", columns: [{ name: "Owner", type: "Ref:People" }] })
    expect(ready).toHaveBeenCalledWith({ requiredAccess: "read table", columns: [{ name: "Owner", type: "Ref" }] })
  })
})
