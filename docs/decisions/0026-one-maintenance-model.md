# 0026. One way to maintain a widget, in the catalog or in its own repository

- **Status:** proposed (drafted 2026-11-28, for the maintainer's decision)
- **Date:** 2026-11-28
- **Amends, once accepted:** [ADR 0011](./0011-reference-widgets-retired.md)
  (what replaces the six reference widgets in the real-widgets job)

## Context

A widget built with the SDK is maintained in one of two places:

- **In the catalog** (`widgets/`, 16 widgets). It builds against the SDK
  of the workspace. A merge to `main` publishes each version that
  `widgets-dist` doesn't have yet ([ADR 0013](./0013-widget-channels.md)).
  CI checks every touched widget in a real Grist and compares it with its
  last release.
- **In a repository of its own**, scaffolded by `npm create grist-widget`.
  This is what everyone outside this repository does. It takes the SDK
  from npm, develops on `dev` and publishes when `dev` is merged into
  `main`.

Both flows ran in full on 2026-11-26 to 28: 0.8.0 on npm, the six
reference widgets onto it and then released, and the catalog. What that
showed:

1. **Nothing says when a fix isn't released.** #136 fixed an SDK read
   (#135) and merged after #137 had released eight catalog widgets. The
   catalog then ran without the fix, and nothing said so: only the
   monthly `release-widgets` run rebuilds each widget against its release.
   The same gap exists on the other side: a widget repository merged into
   `main` without a version bump publishes nothing, with every check green.
2. **The checks that make the catalog reliable stop at its edge.** Its
   real-Grist check, its comparison with the last release and its check of
   what is served after a deploy are scripts of this repository
   (`scripts/real-widgets/`, `scripts/widgets/`). A widget repository's CI
   runs lint, test and build, and nothing checks what it publishes.
3. **Releasing and upgrading a widget repository take too many hands.**
   - Upgrading takes two pull requests: Dependabot's, then a follow-up for
     `create-grist-widget upgrade`. Dependabot's alone doesn't compile when
     a release removes names.
   - `pnpm release` must run on `dev` and push to it, so it doesn't work
     for an agent, nor under a ruleset on `dev`.
   - For the six widgets, the upgrade and release took about 24 pull
     requests and merges, and checks run by hand from this repository.
4. **Deleting the six repositories removes the only test of the external
   path.** The real-widgets job runs each SDK or CLI change against them,
   with the SDK packed as npm would ship it. ADR 0011 moves that job onto
   the catalog widgets, but those build against the workspace. They would
   never see a broken package, a codemod that misses a name, or a template
   file that `upgrade` mangles.

A note on 2026-11-28: the six were released as patches (0.2.1, world-map
0.2.2) on the maintainer's go in the session. ADR 0011 had said they would
get no new release. That go is the exception, and is recorded here.

## Decision

**One maintenance model for every widget, catalog or external. Each check
is written once, in `create-grist-widget`, and both kinds of widget run the
same code.**

1. **The checks move into the CLI.** Each catalog script that judges a
   widget becomes a `create-grist-widget` command:
   - the check in a real Grist (Docker, a pinned image; `e2e-grist.mjs`);
   - the comparison with the last release;
   - the check of what is served after a deploy (the version's folder, and
     the channel serving the same build).

   The catalog's CI calls these commands. A widget repository gets them,
   in its own CI, through `upgrade`. The catalog's daily use then tests
   what external widgets run.
2. **A built change is a release, or CI says why it isn't.** A check
   compares the build with the published version of the same number:
   `widgets-dist/<slug>/<version>/` for the catalog, the repository's
   `/v<version>/` for an external widget.
   - **External:** on the `dev` → `main` pull request it fails when the
     build changed and the version didn't. That ends the silent no-op.
   - **Catalog:** an SDK or `_shared/` change reaches many widgets at
     once, so it doesn't fail the pull request. It lists the widgets
     whose build changed. On `main`, a scheduled job keeps one
     "Unreleased widget changes" pull request open, with those widgets
     raised a patch and a line in each changelog. The agent rewrites those
     lines for the people using each widget, and merges it under
     ADR 0012 when one of its changes matters to them. Otherwise it waits
     for the monthly release. Nothing waits unseen.
3. **One pull request for an SDK update.** In a widget repository, a
   workflow of the template opens one pull request into `dev` with:
   - the new `grist-widget-sdk` and `create-grist-widget`, once pnpm's
     age check allows them;
   - `upgrade` run, its codemods applied;
   - in its description, the uses `upgrade` couldn't rewrite.

   CI then runs the same checks as any other pull request. Dependabot
   stops updating those two packages. The catalog needs none of this: it
   takes the SDK from the workspace.
4. **Releasing is one command, never a direct push.** A widget repository's
   release (the version, the `CHANGELOG.md` entry) ends with the `dev` →
   `main` pull request, from any branch, the same way for a person and for
   an agent. A pull request opened with `GITHUB_TOKEN` starts no CI: the
   implementation has to account for that, as the Version Packages pull
   request does today.
5. **External widgets of record live in this repository.** A few
   widget repositories, kept as fixtures, cover:
   - the declaration of 0.4 (`GRIST_OPTIONS` and `WIDGET_METADATA`);
   - `defineGristWidget`;
   - a widget with settings.

   On every SDK or CLI change, CI scaffolds each fixture with the
   published release, upgrades it to the packed build, then runs
   typecheck, test, build and the real-Grist check. This replaces the six
   repositories in the real-widgets job, not the catalog widgets
   (amending ADR 0011).

## Consequences

- **The order of the work** (`TODO.md`):
  1. the fixtures and the job that upgrades them (decision 5);
  2. archive the six repositories, which stops their Dependabot pull
     requests without losing their history, and delete them once the
     fixtures have run green for a release;
  3. the checks in the CLI (decision 1);
  4. the release check and the "Unreleased widget changes" pull request
     (decision 2);
  5. the update workflow (decision 3);
  6. the release command (decision 4).
- `release-widgets` loses its step 1, which becomes the scheduled job, and
  its step 5, which becomes the check after the deploy.
  `upgrade-reference-widgets` is retired with the six.
- A widget repository's CI gets slower: a real Grist in Docker adds a few
  minutes, on the `dev` → `main` pull request at least.
- The docs pages for upgrading and releasing a widget
  (`apps/www/content/docs/cli/`) change with decisions 3 and 4, and each
  template change carries its "Existing widgets can …" changeset.
- More catalog releases: a fix in the SDK reaches the widgets within days,
  not at the month's end. Each release adds to the site's size, which
  ADR 0025 is about.

## Options not taken

- **Changesets for the catalog widgets.** Each pull request would declare
  the version and the note for each widget, and changesets can raise the
  widgets that depend on the SDK by themselves. Every SDK pull request
  would then carry up to sixteen entries, and nothing of it reaches an
  external widget. The build comparison catches the same changes from what
  is actually built, in both places.
- **Keep the six repositories as the external test.** They are real, but
  they need the upkeep of six products: Dependabot, releases, and the
  hours that went into them on 2026-11-27. They also cover only what they
  happen to use, where fixtures can cover each declaration form on purpose.
- **Fail a catalog pull request whose change reaches a widget's build.**
  Every SDK pull request would have to release up to sixteen widgets, and
  `widgets-dist` would grow with each one.
