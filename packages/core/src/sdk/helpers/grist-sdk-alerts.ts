/**
 * The alerts `mountGristWidget()` shows above a running widget: what needs the
 * user's attention in Grist (column mapping, access, a failed write, an
 * unlinked section). The blocking states (not connected, access refused,
 * required columns unmapped) are `<GristBoundary>`'s, not alerts.
 */

import { CHROME_MESSAGES, formatChrome, useChromeMessages, type GristChromeLocale, type GristChromeMessages } from "../chrome-messages"
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
  | "read-only"

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
  /** The language of the alerts' titles and messages. Defaults to English. */
  locale?: GristChromeLocale
}

const TITLE: Record<GristSdkAlertKind, keyof GristChromeMessages> = {
  "column-mapping": "alertColumnMapping",
  "mapping-pending": "alertColumnMapping",
  "section-not-linked": "alertLinking",
  "source-not-wired": "alertLinking",
  "action-error": "alertActionError",
  "access-insufficient": "alertAccess",
  "map-back-skip": "alertMapBackSkip",
  "cell-issues": "alertCellIssues",
  "read-only": "alertReadOnly",
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
  "read-only": "info",
}

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
    requiredLinking?: "target" | "source"
    suppressAlerts?: readonly GristSdkAlertKind[]
    cellIssues?: readonly GristCellIssue[]
  },
  options: GristSdkAlertsOptions = {}
): GristSdkAlertDescriptor[] {
  if (deriveStatus(state) !== "ready") return []
  const out: GristSdkAlertDescriptor[] = []
  const t = CHROME_MESSAGES[options.locale ?? "en"]
  const alert = (kind: GristSdkAlertKind, message: string, ariaRole: "status" | "alert" = "status"): GristSdkAlertDescriptor => ({
    id: kind,
    kind,
    severity: SEVERITY[kind],
    title: t[TITLE[kind]],
    ariaRole,
    message,
  })

  const mapping = deriveColumnMappingStatus(widget.columns, state.mappings)
  if (mapping.pending) out.push(alert("mapping-pending", t.mappingPendingAlert))
  else if (!mapping.ok) {
    const parts = [t.mappingIncomplete]
    if (mapping.missing.length) parts.push(formatChrome(t.mappingRequired, { columns: mapping.missing.join(", ") }))
    if (mapping.emptyMultiples.length) parts.push(formatChrome(t.mappingEmptyMultiples, { columns: mapping.emptyMultiples.join(", ") }))
    out.push(alert("column-mapping", parts.join(" ")))
  }

  // A widget that writes (full access, or a write it tried), on a document
  // open read-only: why nothing it does changes it.
  if (state.readOnly && (state.declaredAccess === "full" || state.readOnlyRefused)) {
    out.push(alert("read-only", t.readOnlyAlert))
  }

  const failure = state.actionError ?? state.readError
  if (failure && isAccessInsufficientError(failure)) {
    out.push(alert("access-insufficient", t.accessInsufficientAlert, "alert"))
  } else if (state.actionError) {
    out.push(alert("action-error", state.actionError, "alert"))
  }

  if (state.mapBackSkipped.length) {
    const list = state.mapBackSkipped.join(", ")
    out.push(alert("map-back-skip", formatChrome(state.mapBackSkipped.length === 1 ? t.mapBackSkipOne : t.mapBackSkipMany, { columns: list })))
  }

  const cellIssues = widget.cellIssues ?? []
  if (cellIssues.length) {
    const first = cellIssues[0]!
    const where = first.column
      ? formatChrome(t.cellIssueColumn, { column: first.column, row: first.rowId })
      : formatChrome(t.cellIssueRow, { row: first.rowId })
    const more = cellIssues.length > 1 ? formatChrome(t.cellIssueMore, { n: cellIssues.length - 1 }) : ""
    out.push(alert("cell-issues", formatChrome(t.cellIssues, { where, message: first.message, more })))
  }

  // Only for a widget that can't work without the link: most work unlinked,
  // on the whole table, and are selectors only if someone wants one.
  const linking = parseGristWidgetLinkingInfo(state.interaction?.linking)
  if (widget.requiredLinking === "source") {
    if (linking && !linking.asSource) {
      out.push(alert("source-not-wired", t.sourceNotWired))
    }
  } else if (widget.requiredLinking === "target" && isWidgetSectionNotLinked(state.interaction)) {
    const hint = options.sectionNotLinkedHint?.trim()
    out.push(alert("section-not-linked", t.sectionNotLinked + (hint ? ` ${hint}` : "")))
  }

  const suppressed = widget.suppressAlerts ?? []
  return out.filter((a) => !suppressed.includes(a.kind))
}

/** @internal The alerts for the widget under the nearest `<GristWidgetProvider>`; [] outside one. */
export function useGristSdkAlerts(options?: GristSdkAlertsOptions): GristSdkAlertDescriptor[] {
  const { connection, state, cellIssues } = useNearestGristState()
  const { locale } = useChromeMessages()
  if (!connection) return []
  const { columns, requiredLinking, suppressAlerts } = connection.runtime.options
  return getGristSdkAlerts(state, { columns, requiredLinking, suppressAlerts, cellIssues }, { locale, ...options })
}
