# Real widgets

> Read this before touching `.github/workflows/real-widgets.yml` or
> `scripts/real-widgets/`, or when an SDK pull request's real-widgets job
> turns red.

The SDK's own tests and the emulator check the SDK in isolation. The **Real
widgets** workflow (`.github/workflows/real-widgets.yml`) checks it against
widgets people actually use: the **reference widgets** of the
[awesome-grist-widgets](https://github.com/ArthurBlanchon/awesome-grist-widgets)
registry, the entries its `widgets.json` marks `"reference": true`, read from
its `main` branch on every run.

## What runs, and when

| When | What |
| --- | --- |
| A pull request or a push to `main` touching `packages/core`, `packages/create-grist-widget` or these scripts (a job of `ci.yml`) | Each reference widget's `dev` branch (its default branch if it has none), with its `grist-widget-sdk` and `create-grist-widget` pointed at the PR's packed builds: typecheck, test, build |
| Weekly, and on demand (Actions → Real widgets → Run workflow) | The same, plus each build embedded in a real Grist, with a screenshot per widget |

A widget that fails is checked again with the published versions its
lockfile pins. If those fail too, the widget was already failing: the run
reports it and stays green. Only a failure the published versions don't
have is a **regression**, and turns the job red, and with it `ci.yml`'s
`gate`, the one required check: a regression blocks the merge.

Lint stays out: a widget's lint debt isn't the SDK's.

## The catalog widgets

The catalog widgets (`widgets/`) run in `ci.yml`'s `widgets` job, a matrix:
`scripts/ci/changes.mjs` lists the widgets a change touches, in balanced
batches of at most 8.
- A change to one widget's folder runs that widget only.
- A change to `widgets/_shared/`, the SDK, the e2e harness, the lockfile or
  CI itself runs all of them.

Each batch runs its widgets' spec checks, typecheck, lint, tests, build,
bundle sizes, and the real-Grist check below on the pinned image.

**Each week** (Tuesday, and on demand: Actions → Widgets on Grist's latest),
`widgets-latest-grist.yml` runs every catalog widget in
`gristlabs/grist:latest` instead of the pin. It also starts that Grist with the catalog's list added as a plugin, the way
the docs tell an administrator to (`scripts/widgets/gallery-check.mjs`), and
checks that its gallery serves every catalog id next to Grist Labs' own
widgets ([ADR 0014](../decisions/0014-catalog-lists.md)). Run it alone with
`node scripts/widgets/gallery-check.mjs` (Docker). It reports and never
blocks:
- a failure of the real-Grist step, on `main`, opens the issue "Catalog
  widgets fail on Grist's latest image", or comments on it while it stays
  open (an install or a build failing first reports nothing);
- the next passing run closes it.

When it fails:
1. Open the run: its summary names the image's version and each widget's
   result, and the screenshots are in its artifacts.
2. Reproduce with `docker pull gristlabs/grist:latest`, then
   `GRIST_IMAGE=gristlabs/grist:latest pnpm e2e:grist widgets/<slug>`: the
   check doesn't pull, so an older cached `latest` would run instead.
3. Fix the widget or the SDK, before the pin
   (`packages/create-grist-widget/src/grist-local.mjs`) moves to that
   version.

## In a real Grist

`pnpm e2e:grist <widget dir>...` runs the real-Grist part on widgets you
have checked out locally:

```bash
pnpm e2e:grist ../world-map --build      # --build runs the widget's vite build first
pnpm e2e:grist ../world-map --keep       # leaves Grist running and prints the document's URL
```

It needs Docker and Playwright's Chromium (`pnpm exec playwright install
chromium`). For each widget it:

1. reads the widget's declaration (`widget`, or `GRIST_OPTIONS` in an older
   widget) from its own module, through its own Vite config, with no
   per-widget configuration;
2. starts Grist from a pinned Docker image (`GRIST_IMAGE` overrides it, to
   try a newer Grist before bumping the pin);
3. creates a document with a typed column per declared column and a few
   sample rows, the widget's section with the access it requests, every
   column mapped and the section linked to the table;
4. passes when the widget renders past `GristBoundary`, with no uncaught
   exception. Console errors are listed but don't fail it: they include the
   services a widget calls itself, which the check doesn't reach.

It checks the emulator rather than replacing it. A widget that passes its
smoke test (`smokeTestWidget()`) but fails in a real Grist points at a gap
in the emulator, to fix in the SDK.

## Checking one widget by hand

```bash
pnpm --filter grist-widget-sdk build && (cd packages/core && pnpm pack --pack-destination /tmp)
node scripts/real-widgets/check-widget.mjs ArthurBlanchon/world-map --sdk /tmp/grist-widget-sdk-<version>.tgz
```

Add `--cli <tarball>` for a packed `create-grist-widget`, `--e2e` for the
real-Grist run, `--branch main` for the released code.

## Adding a reference widget

A reference widget is built with `grist-widget-sdk`. To add one, mark its
registry entry `"reference": true` in awesome-grist-widgets: from that
pull request's merge on, every run checks it. Removing the mark stops it.

The workflow runs these widgets' code in this repository's CI, with a
read-only token and no secrets. So the mark is the maintainer's to set, on
widgets whose code they trust, never every widget in the registry.
`scripts/real-widgets/list-widgets.mjs` builds the list. It checks each
repository name before any shell sees it, and fails on an empty list
rather than passing a run that checked nothing.

A reference widget that isn't registered yet goes in
`scripts/real-widgets/pending.json`, which the workflow checks too. The
six SDK widgets wait there until their release adds them to the registry,
then the file goes back to `[]`.
