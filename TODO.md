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
- [ ] **Docs rewrite** ([plan](./docs/planning/2026-11-14-docs-rewrite-plan.md)):
  agree the structure (§3), then R1–R6. Done when the old-forms check
  blocks in CI, about 25 user pages remain and every retired URL redirects.
- [ ] **E. The six widgets on 0.7:** the Dependabot pull request moving both
  packages, then `pnpm exec create-grist-widget upgrade` as a follow-up on
  `dev`, the hints it lists fixed by hand, and a `pnpm release`. Done when
  none of the six logs a deprecation warning.
- [ ] **F. 1.0.0:** deprecated names removed, a codemod for each break, the
  API report's baseline reset. Done when the six take it through the same
  flow as E.

## 2. Next project — the widget factory

From the [widget factory plan](./docs/planning/2026-11-14-widget-factory-plan.md);
its direction (W1–W5) was agreed 2026-11-14, for a catalog of 30 to 100
widgets at most. This repository becomes the factory: catalog widgets in
`widgets/`, `examples/` merged into the catalog, awesome-grist-widgets
absorbed and archived, widgets served by the site that already exists
(GitHub Pages and Cloudflare Pages). Simple and durable above all (plan §0.1).

- [ ] **F0.** 0.7 released (#28) and the maintainer docs moved into the
  repository (docs plan, M1).
- [ ] **F1. Layout, with one pilot.** In place: `widgets/` with the Kanban
  board as the pilot, `widgets/_shared/` (shadcn components, theme,
  translations, Vite and ESLint configuration), `SPEC.md` and its check
  (`scripts/widgets/check-widgets.mjs`: spec, criteria named by tests,
  declaration, design rules), the `widgets` CI job. Left: the e2e check in
  a real Grist, axe, the bundle budget and the light and dark screenshots
  for catalog widgets, and `pnpm new-widget`. Done when the pilot passes
  the whole production-grade bar (plan §5).
- [ ] **F2. Versions in the site:** catalog widgets under `/widgets/<slug>/`
  in `build-site.mjs`, released versions kept on a `widgets-dist` branch,
  a size and file budget. Done when the pilot works in Grist from
  `/widgets/<slug>/latest/` on both origins.
- [ ] **F3. Bring the widgets home:** the first list is agreed
  ([`catalog/roadmap.md`](./catalog/roadmap.md): 19 widgets in three
  waves); build wave 1, then waves 2 and 3. Done when `examples/` is gone.
- [ ] **F4–F8:** intake and triage, the build loop, upkeep, the catalog and
  registry, a size check at 30 and 60 widgets (plan §10).

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
