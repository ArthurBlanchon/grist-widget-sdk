# TODO

The one list of work left, in order. Each item says why it matters and when
it is done. Finished work leaves this file: its record is the merged PR, the
changelog and, for larger efforts, the plans in [`docs/history/`](./docs/history/).

The reasoning behind 0.4.0, and what it left for later, is the
[architecture review of 2026-11-09](./docs/history/2026-11-09-architecture-review.md).

## 0. Waiting on the maintainer

- **This repository's settings:** private vulnerability reporting on; the
  deepmerge alert dismissed (dev-only, no fix).
- **Mermaid diagram 0.1.0 shipped elkjs (EPL-2.0 or GPL-3.0) without its
  notice** ([ADR 0015](./docs/decisions/0015-widget-licences.md)). 0.2.0
  replaces it on `/v0/`; `/widgets/mermaid-diagram/0.1.0/` still serves it.
  Either withdraw that version from `widgets-dist`, or add elkjs's licence
  next to it: both are direct pushes to `widgets-dist`, the maintainer's.

## 1. The plan to 0.8.0: the production-grade AI widget factory

From the [plan to 0.8.0](./docs/planning/2026-11-15-plan-0.8.md) §4, in
its order: M5, with M6 (docs) alongside, then M7 (M1 to M4 are done).
Each item is one pull request; the plan says when each milestone is done.

- [ ] **Gantt's comparison with its last release reads ~0.2 % changed** on
  an identical build (the timeline scrolls to "today" on mount, by layout
  timing): make that scroll deterministic in the next Gantt change, so
  `--baseline` reads "unchanged" for it as for the 15 others.
- [ ] **Attachments on the static demo pages.** grist-static serves no
  attachment, so the demo pages of Attachment viewer, File uploader and
  Signature pad open with their attachments cells empty (`pnpm demo` and
  the real-Grist check have the files). Done when grist-static serves them,
  or the demo page hands them to it.
- [ ] **A declared Ref column in typed reads.** Grist sends a reference as
  the text its column shows (`expandRefs`, seen in Grist 1.7.22 and now in
  the emulator), so `mappedRecord` reports a column declared `Ref:<table>`
  as "not a reference". Give typed reads the row id (a fetch of the
  section's ids, or `expandRefs: false` where the plugin API takes it), or
  document the text. A reference showing a Numeric or Int column arrives
  as a `Reference` whose id is the shown number: typed reads would take it
  for the row id, silently. Done when a declared Ref column reads as its
  row id in real Grist and in the emulator, whatever column it shows. The
  emulator should also refuse `fetchTable` below full access, as Grist does.
- [ ] **M5. The loop, from issue to release.** Issue forms and labels; the
  skills `triage-issue`, `new-widget`, `fix-issue`, `catalog-upgrade`,
  `release-widgets`, `sota-review`; upkeep on a schedule.
- [ ] **M6. Documentation, alongside.** R2 to R6 to the 2026-11-14 target
  structure, with *Replica document* as a Concepts page and *Examples* as
  the catalog (R1, the frame, is done: four sections, the docs check in
  report mode).
- [ ] **M7. Bring the widgets home, then retire.** Wave 3 (REST
  enrichment, Ask AI, Scan with AI) after M1–M4; `examples/` removed with
  an API coverage check; awesome-grist-widgets absorbed and archived; the
  six reference repositories retired, the news feed with them
  ([ADR 0011](./docs/decisions/0011-reference-widgets-retired.md)).
- [ ] **Release 0.8.0** when M1–M7 are done.

## 2. After 0.8.0

- **1.0.0:** the API report's baseline reset, the deprecate-first rule in
  force, the `emulator` entry's unexported implementation types settled.
  The catalog takes it in the pull request that makes it.
- **The size check** at 30 widgets, then at 60 (CI time, the site's size,
  the maintainer's time; the shared runtime past 40 % of the budget).
- **More catalog widgets,** from issues and `catalog/roadmap.md`'s "Later".

## 3. Later, if they still matter

From the earlier backlog (`docs/history/TASKS.md`, `docs/history/2026-08-09-execution-plan.md`),
kept only where still relevant after the 0.4.0 review:

- **A config panel affordance** (old batch J): a documented way for a
  widget to show its settings when Grist's "Open configuration" is used
  (`onEditOptions`).
- **Secrets guidance** (old batch K): widget options are not a secrets
  store; document what to do instead.
- **Landing page with a live widget** (old batch N): an example's
  `/examples/<id>/demo/`, embedded.
- **Error-message pass** (task-053): every thrown error names its function
  and gives a one-line hint.

Dropped with the review: the replica-format tasks (030–034), the
playground tasks (040–041), the emulator parity audit (013, now the weekly
real-Grist run), the open-questions sweep (050) and `MIGRATION.md` (054,
the changesets carry it).
