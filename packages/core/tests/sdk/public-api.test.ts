/**
 * Pins the public runtime surface of every entry point. Adding or removing a
 * name is a public API change: update this list, the matching docs page
 * (apps/www/content/docs/sdk/api/), and write a changeset that says what
 * replaces a removed name.
 */

import { describe, expect, it } from "vitest"

import * as sdk from "../../src/sdk"
import * as actions from "../../src/actions"
import * as app from "../../src/app"
import * as emulator from "../../src/emulator"
import * as emulatorTesting from "../../src/emulator/testing"

const ROOT = [
  // Connection, data, writes
  "GristBoundary",
  "GristWidgetProvider",
  "defineGristWidget",
  "useGrist",
  "useGristContext",
  "useGristOptional",
  "useGristSchema",
  "useWidgetMetadata",
  // Cells
  "decodeGristValue",
  "encodeGristValue",
  "isGristCellError",
  "normalizeGristChoiceListEntries",
  "resolveGristFormulaKind",
  "tableDataToRows",
  // Attachments
  "extractGristAttachmentId",
  "extractGristAttachmentIdsFromCell",
  "gristAttachmentCellValue",
  "gristAttachmentCellValues",
  "mergeGristAttachmentCellValue",
  // User actions: deprecated here (they moved to grist-widget-sdk/actions), removed in 1.0
  "gristAddColumnAction",
  "gristAddRecordAction",
  "gristAddTableAction",
  "gristAddVisibleColumnAction",
  "gristModifyColumnAction",
  "gristRemoveColumnAction",
  "gristRemoveRecordAction",
  "gristRenameColumnAction",
  "gristUpdateRecordAction",
  // Typed reads
  "checkGristCell",
  "encodeGristCell",
]

const ACTIONS = [
  "gristAddColumnAction",
  "gristAddRecordAction",
  "gristAddTableAction",
  "gristAddVisibleColumnAction",
  "gristBulkAddRecordAction",
  "gristBulkRemoveRecordAction",
  "gristBulkUpdateRecordAction",
  "gristModifyColumnAction",
  "gristRemoveColumnAction",
  "gristRemoveRecordAction",
  "gristRenameColumnAction",
  "gristUpdateRecordAction",
]

const APP = ["mountGristWidget", "GristWidgetApp", "entryProps", "useTheme", "parseDeployPath", "deployChannelLabel", "useReleasedVersions"]

const EMULATOR = [
  "createGristEmulator",
  "parseDocument",
  "safeParseDocument",
  "presets",
  "EmulatorActionError",
  "enrichEmulatorColumnMetadata",
  "resolveMappings",
]

const EMULATOR_TESTING = [
  "renderWithGrist",
  "smokeTestWidget",
  "installJsdomStubs",
  "actionsOf",
  "eventsOf",
  "waitForEvent",
  "presets",
  // @testing-library/react, re-exported
  "act",
  "cleanup",
  "fireEvent",
  "render",
  "screen",
  "waitFor",
  "within",
]

const keys = (mod: Record<string, unknown>) => Object.keys(mod).filter((k) => mod[k] !== undefined).sort()

describe("public API surface", () => {
  it("grist-widget-sdk exports exactly the documented names", () => {
    expect(keys(sdk)).toEqual([...ROOT].sort())
  })
  it("grist-widget-sdk/actions exports exactly the documented names", () => {
    expect(keys(actions)).toEqual([...ACTIONS].sort())
  })
  it("grist-widget-sdk/app exports exactly the documented names", () => {
    expect(keys(app)).toEqual([...APP].sort())
  })
  it("grist-widget-sdk/emulator exports exactly the documented names", () => {
    expect(keys(emulator)).toEqual([...EMULATOR].sort())
  })
  it("grist-widget-sdk/emulator/testing exports exactly the documented names", () => {
    expect(keys(emulatorTesting)).toEqual([...EMULATOR_TESTING].sort())
  })
})
