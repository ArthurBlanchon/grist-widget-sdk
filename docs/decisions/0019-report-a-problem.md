# 0019. "Report a problem" is a link the person opens, never telemetry

- **Status:** accepted
- **Date:** 2026-11-16

## Context

The plan to 0.8.0 (§3, "Feedback") asks for a "Report a problem" link that
prefills an issue with the widget, its version and Grist's version, and no
telemetry. Three facts shaped it:
- A widget runs in a person's document: an error message can hold their
  data (a cell value, a table name). Sending anything on its own would leak
  it, and would be a new outbound host in every widget's CSP.
- Grist doesn't tell a widget its version: no plugin API call returns it,
  and asking the document's server would be a request a widget never needed.
- A widget that throws while rendering showed a blank panel: the person had
  nothing to report from.

## Decision

- **The SDK links, the widget says where.** `defineGristWidget({ reportUrl })`
  is an http or https URL (checked with `httpUrl()`); `mountGristWidget()`
  shows "Report a problem" to it under a failed write's alert, and on "The
  widget stopped working", the screen that replaces a widget that throws.
  It opens in a new tab with `noopener noreferrer`.
- **Nothing is sent.** No error, no cell, no document id goes into the URL or
  anywhere else: the person writes what they choose.
- **The URL carries what the widget knows at build time:** for the catalog,
  the widget's slug and version, in a GitHub issue form that asks for
  Grist's version and how Grist is hosted.

## Consequences

- A widget without `reportUrl` gets the new crash screen without a link; a
  widget made from the template can add one.
- Grist's version is typed by the person, from Grist's own "About" or
  admin panel; the issue form says where.
- Anything more (an error's stack, a document's shape) is a new decision,
  not an addition to this one.
- Every released widget carries its link for good (a release is never
  rebuilt), so the form's file name (`widget-bug.yml`) and its field ids
  `widget` and `version` stay as they are, prefillable from the URL
  (inputs, not dropdowns). A change to the intake keeps the old link
  working.
