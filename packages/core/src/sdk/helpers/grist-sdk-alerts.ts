/**
 * The alerts `mountGristWidget()` shows above a running widget: what needs the
 * user's attention in Grist (column mapping, access, a failed write, an
 * unlinked section). The blocking states (not connected, access refused,
 * required columns unmapped) are `<GristBoundary>`'s, not alerts.
 */

import { useNearestGristState } from "../use-grist"
import { deriveColumnMappingStatus, deriveStatus } from "../runtime/derive"
import { isAccessInsufficientError } from "../runtime/api"
import type { GristCellIssue } from "../runtime/cells"
import type { GristRuntimeState } from "../runtime/runtime"
import type { GristColumnsToMap, GristWidgetInteraction } from "../types"
import { parseGristWidgetLinkingInfo } from "./grist-widget-interaction"

export type GristSdkAlertKind =
  | "column-mapping"
  | "mapping-pending"
  | "section-not-linked"
  | "source-not-wired"
  | "action-error"
  | "access-insufficient"
  | "map-back-skip"
  | "cell-issues"

export type GristSdkAlertSeverity = "info" | "warning" | "error"

export type GristSdkAlertDescriptor = {
  id: string
  kind: GristSdkAlertKind
  severity: GristSdkAlertSeverity
  title: string
  ariaRole: "status" | "alert"
  message: string
}

export type GristSdkAlertsOptions = {
  /** Added to the "section not linked" message, e.g. how to link in Grist. */
  sectionNotLinkedHint?: string
}

const TITLE: Record<GristSdkAlertKind, string> = {
  "column-mapping": "Column mapping",
  "mapping-pending": "Column mapping",
  "section-not-linked": "Widget linking",
  "source-not-wired": "Widget linking",
  "action-error": "Action error",
  "access-insufficient": "Access level",
  "map-back-skip": "Write skipped",
  "cell-issues": "Unexpected values",
}

const SEVERITY: Record<GristSdkAlertKind, GristSdkAlertSeverity> = {
  "column-mapping": "warning",
  "mapping-pending": "info",
  "section-not-linked": "warning",
  "source-not-wired": "warning",
  "action-error": "error",
  "access-insufficient": "error",
  "map-back-skip": "warning",
  "cell-issues": "warning",
}

const alert = (kind: GristSdkAlertKind, message: string, ariaRole: "status" | "alert" = "status"): GristSdkAlertDescriptor => ({
  id: kind,
  kind,
  severity: SEVERITY[kind],
  title: TITLE[kind],
  ariaRole,
  message,
})

/** A widget section Grist says is linked to nothing. */
export function isWidgetSectionNotLinked(interaction: GristWidgetInteraction | null | undefined): boolean {
  const linking = parseGristWidgetLinkingInfo(interaction?.linking)
  return Boolean(linking) && linking!.asTarget == null
}

/** The alerts for a widget in `state`, pure (tested without React). */
export function getGristSdkAlerts(
  state: GristRuntimeState,
  widget: {
    columns?: GristColumnsToMap
    allowSelectBy?: boolean
    suppressAlerts?: readonly GristSdkAlertKind[]
    cellIssues?: readonly GristCellIssue[]
  },
  options: GristSdkAlertsOptions = {}
): GristSdkAlertDescriptor[] {
  if (deriveStatus(state) !== "ready") return []
  const out: GristSdkAlertDescriptor[] = []

  const mapping = deriveColumnMappingStatus(widget.columns, state.mappings)
  if (mapping.pending) out.push(alert("mapping-pending", "Waiting for Grist to report column mappings."))
  else if (!mapping.ok) {
    const parts = ["Column mapping is incomplete."]
    if (mapping.missing.length) parts.push(`Required columns: ${mapping.missing.join(", ")}.`)
    if (mapping.emptyMultiples.length) parts.push(`Assign at least one sheet column for: ${mapping.emptyMultiples.join(", ")}.`)
    out.push(alert("column-mapping", parts.join(" ")))
  }

  const failure = state.actionError ?? state.readError
  if (failure && isAccessInsufficientError(failure)) {
    out.push(
      alert(
        "access-insufficient",
        'This operation requires "Full document access". Set the Access level to "Full document access" in the Custom widget configuration panel.',
        "alert"
      )
    )
  } else if (state.actionError) {
    out.push(alert("action-error", state.actionError, "alert"))
  }

  if (state.mapBackSkipped.length) {
    const list = state.mapBackSkipped.join(", ")
    out.push(alert("map-back-skip", `mapBack skipped multi-mapped column${state.mapBackSkipped.length === 1 ? "" : "s"}: ${list}.`))
  }

  const cellIssues = widget.cellIssues ?? []
  if (cellIssues.length) {
    const first = cellIssues[0]!
    const where = first.column ? `${first.column} in row ${first.rowId}` : `row ${first.rowId}`
    const more = cellIssues.length > 1 ? ` (and ${cellIssues.length - 1} more)` : ""
    out.push(alert("cell-issues", `${where}: ${first.message}${more}. Check the column's type, or the cell, in Grist.`))
  }

  const linking = parseGristWidgetLinkingInfo(state.interaction?.linking)
  if (widget.allowSelectBy) {
    if (linking && !linking.asSource) {
      out.push(
        alert(
          "source-not-wired",
          "This widget is configured as a selector (allowSelectBy) but no other section is using it as a link source yet. Link another section to read from this widget."
        )
      )
    }
  } else if (isWidgetSectionNotLinked(state.interaction)) {
    const hint = options.sectionNotLinkedHint?.trim()
    out.push(
      alert(
        "section-not-linked",
        "This widget section is not linked to a table or selector. Link it from the page settings so the selected row is sent to the widget." +
          (hint ? ` ${hint}` : "")
      )
    )
  }

  const suppressed = widget.suppressAlerts ?? []
  return out.filter((a) => !suppressed.includes(a.kind))
}

/** @internal The alerts for the widget under the nearest `<GristWidgetProvider>`; [] outside one. */
export function useGristSdkAlerts(options?: GristSdkAlertsOptions): GristSdkAlertDescriptor[] {
  const { connection, state, cellIssues } = useNearestGristState()
  if (!connection) return []
  const { columns, allowSelectBy, suppressAlerts } = connection.runtime.options
  return getGristSdkAlerts(state, { columns, allowSelectBy, suppressAlerts, cellIssues }, options)
}
