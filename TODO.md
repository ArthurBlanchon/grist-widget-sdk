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
  runs `eval` (ADR 0016's amendment), so the scaffold would ship a pinned
  copy as the catalog does. Done with M7, or earlier on the train.

- [ ] **Linking in the emulator, and by mode:** the emulator reports no
  `linking`, so a widget's test can't open it unlinked
  (`createGristEmulator({ linking })` would); and `requiredLinking` is one
  value for every mode, so a widget whose viewer mode needs the selected
  row and whose gallery mode doesn't (Attachment viewer, Document
  template, Mermaid diagram) declares none. Done when a test can open a
  widget unlinked and a declaration can depend on its options.

- [ ] **Hosting that holds at 100 widgets** ([ADR 0025](./docs/decisions/0025-widget-hosting-growth.md),
  proposed). After one week the site is about 230 MB: grist-static
  89 MB in 1,501 files, `widgets-dist` 131.5 MB in 1,899 files for 16
  widgets, every release repeating its fonts and Grist's plugin API. At
  100 widgets released monthly, GitHub Pages' 1 GB and Cloudflare's
  20,000 files are about a year away (`scripts/site/budget.mjs` warns at
  60 %). Done when the ADR is decided and applied, and the budget's trend
  is in the site-deploy runbook. With it, the option to investigate:
  grist-static from a CDN instead of its 1,501 files.
- [ ] **A fresh install in the real-Grist check.** `--standard` opens each
  widget with its columns already mapped through the API, its options set
  and, until #122, its section linked: kinder than a person adding it to a
  page. Two of this week's production bugs hid there (the plugin API's
  `eval`, the false linking alert). Add a scenario per widget: no mapping,
  no options, linked to nothing; it renders the SDK's mapping screen and no
  error, then works once mapped through Grist's own panel.
- [ ] **A weekly smoke run on hosted Grist** (docs.getgrist.com): the
  pinned Docker image is not the service most people use (its iframe
  sandbox, its plugin API, "Report a problem" opening a tab). Each
  widget's `/dev/` in a test document of a dedicated account. Needs the
  maintainer: the account, and its API key as an environment secret.
- [ ] **Grist's own UI flows in the check:** mapping a column in the
  creator panel, and "Open configuration" (`hasCustomOptions`), clicked as
  a person does. Checked by hand for the Gantt on 2026-11-22 only.
- [ ] **The SDK's Settings view across the catalog.** The Gantt (0.4.5)
  exports `Settings`, and `mountGristWidget()` draws the full-panel view,
  with Grist's Save reminder (`optionsDraft`). Chart builder, Kanban board,
  Mail merge, Document template and File uploader write options too: their
  settings move into an exported `Settings`, a patch each. What is a
  setting for everyone moves there; what only changes the view for now
  (a chart's type, a zoom) stays in the toolbar, in React state.
- [ ] **A rollback runbook.** A bad release on `/v<major>/` can only be
  replaced by a new one, and releases are monthly. Write the emergency
  path in `docs/operations/site-deploy.md`: an immediate revert release
  through `release-widgets`, and whether the channel may point back at the
  previous version meanwhile (a direct push to `widgets-dist`: the
  maintainer's).
- [ ] **Install from `/v<major>/` only, said where people install.** A
  release pins Grist's plugin API (ADR 0016): if Grist ever changes its
  protocol, the weekly latest-Grist run sees it and a new release fixes the
  channel, never a pinned `/<version>/`. The catalog pages and the
  install docs say to use the channel, and why.
- [ ] **The weekly upkeep without a go each week,** once M5 has run: the
  catalog's dependency versions live in `pnpm-workspace.yaml`, so each
  green `catalog-upgrade` waits for the maintainer (ADR 0012). Propose an
  amendment: the agent merges a catalog patch or minor update when it is
  green and compared with the last releases.

## 2. After 0.8.0

- **1.0.0:** the API report's baseline reset, the deprecate-first rule in
  force, the `emulator` entry's unexported implementation types settled.
  The catalog takes it in the pull request that makes it.
- **The size check** at 30 widgets, then at 60 (CI time, the site's size,
  the maintainer's time; the shared runtime past 40 % of the budget).
- **More catalog widgets,** from issues and `catalog/roadmap.md`'s "Later".
- **More languages than English and French:** Grist ships about twenty;
  the chrome follows a widget's `languages` (ADR 0021), the catalog's
  dictionaries would take contributed ones.
- **A screen-reader pass** on each category, beyond axe and the keyboard
  path (in `sota-review`).
- **The vendored kibo-ui Gantt** now differs from upstream (the day
  header draws only the months near the view): an upstream update is a
  merge by hand, noted in `widgets/_shared/kibo-ui/`.

## 3. Later, if they still matter

From the earlier backlog (`docs/history/TASKS.md`, `docs/history/2026-08-09-execution-plan.md`),
kept only where still relevant after the 0.4.0 review:

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
