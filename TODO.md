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
its order: M5, then M7 (M1 to M4 and M6 are done).
Each item is one pull request; the plan says when each milestone is done.

- [ ] **Attachments on the static demo pages.** grist-static serves no
  attachment, so the demo pages of Attachment viewer, File uploader and
  Signature pad open with their attachments cells empty (`pnpm demo` and
  the real-Grist check have the files). Done when grist-static serves them,
  or the demo page hands them to it.
- [ ] **M5. The loop, from issue to release.** Left: three real issues
  from report to release through the skills, with only the maintainer's
  approvals (the plan's "done when"), and the scheduled runs set up as
  tasks. Done: the four issue forms, no blank issues, the labels from the
  catalog, the six skills (`triage-issue`, `fix-issue`, `new-widget`,
  `catalog-upgrade`, `release-widgets`, `sota-review`), what agents do to
  issues ([ADR 0020](./docs/decisions/0020-agents-on-issues.md)), the
  upkeep schedule ([upkeep](./docs/operations/upkeep.md)). Every released
  widget links `widget-bug.yml`, so its file name and its `widget` and
  `version` ids stay (ADR 0019).
- [ ] **M7. Bring the widgets home, then retire.** Wave 3 (REST
  enrichment, Ask AI, Scan with AI) after M1–M4; awesome-grist-widgets
  absorbed and archived; the
  six reference repositories retired, the news feed with them
  ([ADR 0011](./docs/decisions/0011-reference-widgets-retired.md)).
- [ ] **The catalog's widgets declare `languages: ["en", "fr"]`** once the
  SDK release with it is out ([ADR 0021](./docs/decisions/0021-chrome-language.md)),
  so their chrome matches their messages: a patch release of each.
- [ ] **One click on "Report a problem" inside Grist** on `/widgets/<slug>/dev/`
  before the next widget release: whether Grist's iframe sandbox lets the
  link open its tab. Done when checked, or the link works around it.
- [ ] **Gantt's comparison with its last release reads ~0.2 % changed** on
  an identical build (the timeline scrolls to "today" on mount, by layout
  timing): make that scroll deterministic in the next Gantt change, so
  `--baseline` reads "unchanged" for it as for the 15 others.
- [ ] **`w.mappings` spells Grist's `null`**: Grist, and the emulator since
  #111, send `null` for an unmapped column, which `GristWidgetColumnMap`
  (`string | string[] | undefined`) doesn't allow. Add `| null`, with the API
  report, and split a declared type into its bases in one helper (`basesOf`,
  used in four places). Done when the type and the helper land.
- [ ] **Release 0.8.0** now that the refactoring is done
  ([ADR 0024](./docs/decisions/0024-release-0.8-before-m5-m7.md)): the
  Version Packages pull request, on the maintainer's go. M5 and M7 above
  continue towards 0.9.0.
- [ ] **The template's Content Security Policy and standard criteria**
  (the plan put them in 0.8.0; ADR 0024 moves them): a scaffold meets the
  catalog's bar (ADR 0016, ADR 0018). A policy without `unsafe-eval` needs
  a production plugin API: docs.getgrist.com's is a development build that
  runs `eval` (ADR 0016's amendment), so the scaffold would load a pinned
  production copy as the catalog does. Done with M7, or earlier on the train.

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
- **Landing page with a live widget** (old batch N): a catalog
  widget's `/widgets/<slug>/demo/`, embedded.
- **Error-message pass** (task-053): every thrown error names its function
  and gives a one-line hint.

Dropped with the review: the replica-format tasks (030–034), the
playground tasks (040–041), the emulator parity audit (013, now the weekly
real-Grist run), the open-questions sweep (050) and `MIGRATION.md` (054,
the changesets carry it).
