# TODO

The one list of work left, in order. Each item says why it matters and when
it is done. Finished work leaves this file: its record is the merged PR, the
changelog and, for larger efforts, the plans in [`docs/history/`](./docs/history/).

The reasoning behind 0.4.0, and what it left for later, is the
[architecture review of 2026-11-09](./docs/history/2026-11-09-architecture-review.md).

## 0. Waiting on the maintainer

- **Rulesets on the six widget repos** (U5): `main` requires a pull request
  and the `check` status, and blocks force pushes and deletion; `dev`
  blocks force pushes and deletion.

## 1. The developer experience plan

From the [developer experience review](./docs/planning/2026-11-12-developer-experience-review.md) §5.

- [ ] **The six reference widgets on 0.6**, once `grist-widget-sdk` and
  `create-grist-widget` 0.6.0 are a day old: bump, `pnpm exec
  create-grist-widget upgrade` (its codemods rewrite the deprecated names),
  and change by hand what it lists (create-email-draft's `isAvailable`).
  Done when the six run without a deprecation warning.
- [ ] **1.0**: deprecated names removed; a written versioning policy (deprecate
  for a minor, remove in the next major, a codemod for each break); an API
  report (`.d.ts`) checked in CI; React 18 and 19 in the core job's matrix;
  grouped Dependabot with an automatic `upgrade` on the widget's PR;
  `pnpm release` for widgets. Decide the page-wide connection first.

## 2. Next project — the core widget library

A library of widgets built with the SDK, developed with AI, each a real
repo scaffolded by `create-grist-widget`, registered in awesome-grist-widgets
and, where it earns it, a reference widget. Scope to be agreed: which
widgets, the bar each must meet, and how agents build and verify them
(`pnpm test`, `pnpm demo`, the real-Grist check).

- [ ] Agree the scope (list, quality bar, process).
- [ ] The 16 `examples/` become seeds for it; once the library exists,
  `create --example` starts from a library widget and the CLI stops
  embedding the examples.

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
