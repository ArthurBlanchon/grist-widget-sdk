import { describe, expect, it } from "vitest"

import { getGristSdkAlerts, isWidgetSectionNotLinked } from "../../src/sdk/helpers/grist-sdk-alerts"
import { initialRuntimeState, type GristRuntimeState } from "../../src/sdk/runtime/runtime"

const ready = (patch: Partial<GristRuntimeState> = {}): GristRuntimeState => ({
  ...initialRuntimeState(),
  connection: "ready",
  mappings: {},
  ...patch,
})
const kinds = (state: GristRuntimeState, widget = {}) => getGristSdkAlerts(state, widget).map((a) => a.kind)

describe("getGristSdkAlerts", () => {
  it("shows nothing before the widget is ready, or when all is well", () => {
    expect(kinds({ ...ready(), connection: "connecting" })).toEqual([])
    expect(kinds(ready())).toEqual([])
  })

  it("asks to map the required columns, and waits while Grist hasn't reported them", () => {
    const columns = ["Title", { name: "Tags", allowMultiple: true }]
    const [alert] = getGristSdkAlerts(ready({ mappings: { Tags: [] } }), { columns })
    expect(alert).toMatchObject({ kind: "column-mapping", severity: "warning" })
    expect(alert!.message).toBe("Column mapping is incomplete. Required columns: Title. Assign at least one sheet column for: Tags.")
    expect(kinds(ready({ mappings: null }), { columns })).toEqual(["mapping-pending"])
  })

  it("reports a refused write or read as an access problem, any other failed write as itself", () => {
    expect(kinds(ready({ actionError: "Access not granted. Current access level read table" }))).toEqual(["access-insufficient"])
    expect(kinds(ready({ readError: "RPC_ONCALL_ERROR Access denied" }))).toEqual(["access-insufficient"])
    const [alert] = getGristSdkAlerts(ready({ actionError: "Invalid row id" }), {})
    expect(alert).toMatchObject({ kind: "action-error", message: "Invalid row id", ariaRole: "alert" })
  })

  it("names the columns mapBack couldn't write", () => {
    const [alert] = getGristSdkAlerts(ready({ mapBackSkipped: ["Tags"] }), {})
    expect(alert!.message).toBe("mapBack skipped multi-mapped column: Tags.")
  })

  it("says when the section is linked to nothing, or a selector is wired to nothing", () => {
    const unlinked = ready({ interaction: { access_level: "read table", linking: { asTarget: null, asSource: null } } as never })
    expect(kinds(unlinked)).toEqual(["section-not-linked"])
    expect(kinds(unlinked, { allowSelectBy: true })).toEqual(["source-not-wired"])
    expect(getGristSdkAlerts(unlinked, {}, { sectionNotLinkedHint: "Use Link." })[0]!.message).toMatch(/Use Link\.$/)
  })

  it("drops the kinds a widget suppresses", () => {
    const unlinked = ready({ interaction: { linking: { asTarget: null } } as never })
    expect(kinds(unlinked, { suppressAlerts: ["section-not-linked"] })).toEqual([])
  })
})

describe("isWidgetSectionNotLinked", () => {
  it("is true only when Grist reports linking info without a link target", () => {
    expect(isWidgetSectionNotLinked(null)).toBe(false)
    expect(isWidgetSectionNotLinked({ linking: { asTarget: null } } as never)).toBe(true)
    expect(isWidgetSectionNotLinked({ linking: { asTarget: { sectionId: 1 } } } as never)).toBe(false)
  })
})
