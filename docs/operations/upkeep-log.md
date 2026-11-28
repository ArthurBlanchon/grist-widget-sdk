# Upkeep log

> One line per scheduled run ([upkeep](./upkeep.md)), latest first: the
> date, the skill, and what it did, or that there was nothing to do. A
> rhythm with no recent line is a missed run.

- 2026-11-28: `release-widgets` (by hand, on the maintainer's go, outside
  the monthly run): the SDK fix for a ChoiceList's first choice "E" (#135)
  had stayed out of the catalog, #136 having merged after #137's release.
  All 16 widgets' builds differed from their releases; all 16 released as
  patches in #145 (record-editor 0.2.4 the fix, schema-viewer 0.2.2 without
  the linking alert, the others rebuilt). CI: 15 unchanged on screen, the
  Gantt at its 0.17 % floor. Each version served on both origins, on `/v0/`
  and `/latest/`, and in `catalog.json`. How it went unseen: ADR 0026,
  proposed (#146).
- 2026-11-16: `sota-review`, visualisation (run by hand, before the
  scheduled tasks exist): five issues opened, #91 to #95. #92 (mermaid
  limits), #93 (grouped-view counts) and #94 (kanban keyboard) are released;
  #91 (demo pages) waits for the go on #99; #95 (mermaid text alternative)
  is `proposed`.
- 2026-11-16: the schedule set; no run yet.
