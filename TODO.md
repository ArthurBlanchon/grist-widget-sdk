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
- **This repository's settings:** private vulnerability reporting on; the
  deepmerge alert dismissed (dev-only, no fix).

## 1. The plan to 1.0

From the [project review and plan to 1.0](./docs/planning/2026-11-14-review-and-1.0-plan.md) §5;
its decisions D1–D5 were accepted as recommended. Releases follow the weekly
train (`RELEASING.md`).

- [ ] **A. Catch up:** the six reference widgets on 0.6.2 on `dev` (from the
  unmerged 0.5.0 branches; scheduled 2026-11-15), released 0.3.0, the
  registry refreshed (awesome-grist-widgets#10), their own Dependabot majors
  triaged. Done when every reference widget runs 0.6.2 in production with no
  deprecation warning.
- [ ] **C. 0.7.0:** released with the next weekly train. Done in the
  code: the API report and React 18/19 in CI, the versioning policy, the
  page-wide connection and `useGristSchema()`'s connection options
  deprecated with `upgrade` hints, the types public signatures use
  exported. Left for 1.0 to decide: the `emulator` entry's report still
  names unexported implementation types (`GristApiImpl`, `GristDocApiImpl`,
  …): export them as types or narrow the entry's signatures to interfaces.
- [ ] **E. The six widgets on 0.7:** the Dependabot pull request moving both
  packages, then `pnpm exec create-grist-widget upgrade` as a follow-up on
  `dev`, the hints it lists fixed by hand, and a `pnpm release`. Done when
  none of the six logs a deprecation warning.
- [ ] **F. 1.0.0:** deprecated names removed, a codemod for each break, the
  API report's baseline reset. Done when the six take it through the same
  flow as E.

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
