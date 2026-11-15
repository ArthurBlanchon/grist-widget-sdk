/**
 * Action builders — see /api/helpers#action-builders
 *
 * These are pure, sync functions. The test asserts the exact tuple shape so the
 * Grist user-action wire format stays stable.
 */

import { describe, expect, it } from "vitest"

import {
  gristAddColumnAction,
  gristAddRecordAction,
  gristAddTableAction,
  gristAddVisibleColumnAction,
  gristModifyColumnAction,
  gristRemoveColumnAction,
  gristRemoveRecordAction,
  gristRenameColumnAction,
  gristUpdateRecordAction,
} from "../../src/actions"

describe("record action builders", () => {
  it("AddRecord uses null for rowId", () => {
    expect(gristAddRecordAction("Tasks", { Title: "x" })).toEqual([
      "AddRecord",
      "Tasks",
      null,
      { Title: "x" },
    ])
  })

  it("UpdateRecord includes row id and patch", () => {
    expect(gristUpdateRecordAction("Tasks", 42, { Done: true })).toEqual([
      "UpdateRecord",
      "Tasks",
      42,
      { Done: true },
    ])
  })

  it("RemoveRecord shape", () => {
    expect(gristRemoveRecordAction("Tasks", 1)).toEqual(["RemoveRecord", "Tasks", 1])
  })




})

describe("column action builders", () => {
  it("AddColumn", () => {
    expect(
      gristAddColumnAction("Tasks", "Priority", { type: "Choice" })
    ).toEqual(["AddColumn", "Tasks", "Priority", { type: "Choice" }])
  })

  it("AddVisibleColumn", () => {
    expect(
      gristAddVisibleColumnAction("Tasks", "Priority", { type: "Choice" })
    ).toEqual(["AddVisibleColumn", "Tasks", "Priority", { type: "Choice" }])
  })

  it("ModifyColumn", () => {
    expect(
      gristModifyColumnAction("Tasks", "Priority", { type: "Text" })
    ).toEqual(["ModifyColumn", "Tasks", "Priority", { type: "Text" }])
  })

  it("RenameColumn", () => {
    expect(gristRenameColumnAction("Tasks", "Title", "Name")).toEqual([
      "RenameColumn",
      "Tasks",
      "Title",
      "Name",
    ])
  })

  it("RemoveColumn", () => {
    expect(gristRemoveColumnAction("Tasks", "Title")).toEqual([
      "RemoveColumn",
      "Tasks",
      "Title",
    ])
  })
})

describe("table action builders", () => {
  it("AddTable", () => {
    expect(gristAddTableAction("Reports", { columns: [] })).toEqual([
      "AddTable",
      "Reports",
      { columns: [] },
    ])
  })




})
