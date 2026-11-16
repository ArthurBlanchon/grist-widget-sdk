# 0018. Every catalog widget meets four standard criteria

- **Status:** accepted
- **Date:** 2026-11-16
- **Amends:** the plan to 0.8.0, §3: the volume budget is DOM nodes, not
  time measured as the SDK's bench does

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
  deterministic, and it is what makes a page slow. Measured on the 16
  widgets, on their demo data repeated to 5,000 rows: the ones that render
  every row are the slow ones (the Gantt 91,300 nodes and 34 s in jsdom,
  the Kanban board 22,500, Duplicate finder 20,100, Mail merge 16,000), the
  others stay under 650 (Record selector 608).

## Decision

- **Every spec has a "Standard criteria" section** listing `AC-volume`,
  `AC-keyboard`, `AC-narrow` and `AC-readonly`, in the wording `new-widget`
  writes. A widget may add to that wording what is its own (what its
  keyboard path's main action is), never remove from it.
- **`AC-volume` has a test in the widget,** named `it("AC-volume …")`, that
  calls `expectVolume(<App />, widget, demo)` (`widgets/_shared/testing.ts`):
  the demo's document, its widget table repeated to 5,000 rows, mapped as
  the demo maps it, renders with at most `VOLUME_NODES` (3,000) DOM nodes
  once the page stops changing. The budget lives there, not in each widget.
  A widget that shows every row virtualises, pages or groups them.
- **`AC-keyboard`, `AC-narrow` and `AC-readonly` are checked in a real
  Grist** by `e2e-grist.mjs --standard`, in the catalog's CI and its weekly
  run on Grist's latest: Tab reaches the widget's controls without getting
  stuck in a loop, and axe passes after it; no horizontal overflow at 320 px nor at 1,280 px; the document
  open in view mode renders, and a widget that writes says why it can't
  (the SDK's `read-only` alert). A widget's test may add to them; it doesn't
  replace them.
- **`check-widgets` requires the section** in every spec but those of the
  widgets still to migrate (`STANDARD_PENDING`, a list that only shrinks),
  and wherever the section is, an `AC-volume` test that isn't skipped and
  calls `expectVolume()`.

## Consequences

- The four criteria cost a new widget nothing to write: `new-widget` puts
  the section and the `AC-volume` test in place.
- A widget that renders every row (the Gantt, the Kanban board, Duplicate
  finder, Mail merge today) has work to do before its spec can carry the
  section.
- The node budget is a proxy: a widget under it can still be slow (an
  expensive computation per row). The e2e check's timings and the bench
  stay the place to look at time.
- The rows repeat the demo's, so they keep its number of distinct values. A
  widget that makes an element per distinct value (a category, a group, a
  legend item) adds a case where that column is unique per row
  (`expectVolume(…, { unique: [column] })`), and caps or pages them.
- An attachments cell is measured empty: the demo's files aren't in the
  emulator. A widget that shows files caps them (Attachment viewer's gallery
  shows 60).
