# 0018. Every catalog widget meets four standard criteria

- **Status:** accepted
- **Date:** 2026-11-16

## Context

The plan to 0.8.0 (§3, the bar version 2) asks every catalog widget to hold
under volume (5,000 rows), from the keyboard, in a narrow side panel and at
full width, and on a document open read-only. A widget's own criteria
(`AC-1`, `AC-2`…) say what it does; these four say how any widget behaves,
so they are written the same way in every spec and checked the same way.

Two facts shaped how they are checked:
- jsdom has no layout: a test can't see that a panel overflows at 320 px,
  that focus moves, or how Grist opens a document read-only. A real browser
  in a real Grist can (the e2e check, `--standard`).
- Time is a poor budget in CI: the same render takes twice as long on a
  busy runner. The number of DOM nodes a widget makes for 5,000 rows is
  deterministic, and it is what makes a page slow: measured on the 16
  widgets, the ones that render every row (91,000 nodes for the Gantt, 34 s
  in jsdom) are the slow ones, the others stay under 650.

## Decision

- **Every spec has a "Standard criteria" section** listing `AC-volume`,
  `AC-keyboard`, `AC-narrow` and `AC-readonly`, in the wording `new-widget`
  writes. A widget may add to that wording what is its own (what its
  keyboard path's main action is), never remove from it.
- **`AC-volume` has a test in the widget,** named `it("AC-volume …")`: the
  widget renders 5,000 rows, built from its demo data
  (`volumeRows()` in `widgets/_shared/testing.ts`), with at most
  `VOLUME_NODES` (3,000) DOM nodes. A widget that shows every row
  virtualises, pages or groups them.
- **`AC-keyboard`, `AC-narrow` and `AC-readonly` are checked in a real
  Grist** by `e2e-grist.mjs --standard`, in the catalog's CI and its weekly
  run on Grist's latest: Tab reaches the widget's controls and axe passes
  after it; no horizontal overflow at 320 px nor at 1,280 px; the document
  open in view mode renders, and a widget that writes says why it can't
  (the SDK's `read-only` alert). A widget's test may add to them; it doesn't
  replace them.
- **`check-widgets` requires the section** in every spec once the 16 catalog
  widgets carry it, and the `AC-volume` test wherever the section is.

## Consequences

- The four criteria cost a new widget nothing to write: `new-widget` puts
  the section and the `AC-volume` test in place.
- A widget that renders every row (the Gantt, the Kanban board, Duplicate
  finder, Mail merge today) has work to do before its spec can carry the
  section.
- The node budget is a proxy: a widget under it can still be slow (an
  expensive computation per row). The e2e check's timings and the bench
  stay the place to look at time.
