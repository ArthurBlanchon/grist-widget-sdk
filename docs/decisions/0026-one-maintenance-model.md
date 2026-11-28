# 0026. One way to maintain a widget, in the catalog or in its own repository

- **Status:** accepted, on the maintainer's go of 2026-11-28 on #146,
  after its two independent reviews. Accepting it is not a go for the pull
  requests that implement it: each one takes its own, by ADR 0012's
  table.
- **Date:** 2026-11-28
- **Amends:** [ADR 0011](./0011-reference-widgets-retired.md)
  (the six reference widgets stay, as the external widgets of record)

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
     for an agent whose pushes are kept to its own branches.
   - For the six widgets, the upgrade and release took about 24 pull
     requests and merges, and checks run by hand from this repository.
4. **Deleting the six repositories removes the only test of the external
   path.** The real-widgets job runs each SDK or CLI change against them,
   with the SDK packed as npm would ship it. ADR 0011 moves that job onto
   the catalog widgets, but those build against the workspace. They would
   never see a broken package, a codemod that misses a name, or a template
   file that `upgrade` mangles.

A note on 2026-11-28: the six were released as patches (0.2.1, world-map
0.2.2) on the maintainer's go in the session, although ADR 0011 had said
they would get no new release. On the same day the maintainer decided to
keep them as the reference for now (decision 5).

## Decision

**One maintenance model for every widget, catalog or external. Each check
is written once, in `create-grist-widget`, and both kinds of widget run the
same code.**

1. **The checks move into the CLI.** Each catalog script that judges a
   widget becomes a `create-grist-widget` command:
   - the check in a real Grist (Docker, its image pinned by digest, not by
     tag, once every widget's CI depends on it; `e2e-grist.mjs`);
   - the comparison with the last release;
   - the check of what is served after a deploy (the version's folder, and
     the channel serving the same build).

   The catalog's CI calls these commands, and a widget repository gets
   them, in its own CI, through `upgrade`. The catalog runs them from the
   workspace, so it shares their code with external widgets but not their
   packaging. The packed and published CLI is tested by the real-widgets
   job (decision 5).
2. **A built change is released, or shown as unreleased.** A check
   compares a build with the published version of the same number.
   - **What is compared:** the build made as the release makes it (the
     release's `--base`), against the published files read from a
     read-only clone of the published branch (`widgets-dist`, or the
     repository's `gh-pages`), not from the live site. Left out are the
     files and fields the release adds or that change on every build: for
     the catalog `release.json` and `CHANGELOG.md`, for an external widget
     `showcase-meta.json`, `version.json` and the manifest's
     `lastUpdatedAt`. A change to the fields Grist shows (the name, the
     description, the access) counts. The versions of the SDK and the CLI
     that the manifest records don't count on their own: a bump of the CLI
     alone, with the bundle unchanged, is not a release.
   - **External:** on every pull request into `main` the check fails when
     the build changed and the version didn't, which ends the silent
     no-op. A pull request that doesn't change the build, docs for
     example, passes. A change that should not be released yet waits on
     `dev`: there is no other escape, since merging is releasing. A
     Dependabot security pull request, which opens on `main`, fails it
     too. It is closed, and the fix goes through `dev` with a release.
     On the `dev` → `main` pull request the check also makes sure that
     the version commit, or its merge, is `dev`'s tip, so that nothing
     lands under a version without its changelog line.
   - **Catalog:** an SDK or `_shared/` change reaches many widgets at
     once, so it doesn't fail the pull request. The check lists the
     widgets whose build changed. On `main`, a scheduled job keeps one
     "Unreleased widget changes" pull request open:
     - It only adds: a widget not listed yet gets a patch, as a default,
       and a placeholder line in its changelog. It never rewrites what is
       already on the branch, so the agent's work stays.
     - The agent chooses each version again by `widgets/AGENTS.md`
       (a patch, a minor, or a major if in doubt) and writes each line for
       the people using the widget. A major, a raised access, a new
       outbound host or a security fix takes the maintainer's go
       (ADR 0012).
     - The job builds in a read-only job without secrets, which hands on
       a list of slugs and nothing else. A second job, which runs no
       package code, does the following:
       - checks each slug against `^[a-z0-9-]+$` and against the folders
         in `widgets/`;
       - raises only the `version` in that widget's `package.json`;
       - writes a fixed placeholder line in its changelog;
       - pushes one fixed branch.

       A ruleset on `widgets-dist` blocking force pushes and deletion
       would also keep any token off production's branch. That is a
       setting, and the maintainer's.
     - Pushed with `GITHUB_TOKEN`, the pull request starts no CI. As with
       the Version Packages pull request, its runs are approved or re-run
       before it can be green and merged.

     It is merged when one of its changes matters to the people using a
     widget, or at the monthly release. Nothing waits unseen.
3. **One command for an SDK update, one pull request.** In a widget
   repository, `create-grist-widget update` (run by the owner or an agent,
   on a branch from `dev`):
   - moves `grist-widget-sdk` and `create-grist-widget` to the newest
     release that is at least 7 days old (the cooldown the template's
     Dependabot has today, longer than pnpm's 24 hours, since these two
     packages are the first a compromise of this repository's publishing
     would reach), and never writes a `minimumReleaseAgeExclude` entry;
   - runs `upgrade`;
   - commits;
   - opens one pull request into `dev`, listing in its description the
     uses `upgrade` couldn't rewrite.

   Its CI runs like any other pull request's. No workflow does this with a
   stored token:
   - `GITHUB_TOKEN` can't push a change to `.github/workflows/`, which
     `upgrade` rewrites, and its pull requests start no CI;
   - a personal token stored in every widget repository, next to an
     install of a just-published package and a run of its code, would let
     a compromised release push `dev` and `gh-pages`.

   Run locally, `update` runs the new release's code on the machine of
   whoever runs it, as `upgrade` does today. What protects them is the
   7-day wait, not where it runs.

   A scheduled workflow of the template, daily and on demand, only tells.
   In a read-only job without secrets, it installs the new release,
   upgrades, typechecks and tests. It then opens or updates one issue: the
   version, the result, and the uses to change by hand. A second job,
   which runs no package code, writes the issue. Its body comes from
   running a just-published package, so whoever then runs `update`
   reads it as data ([untrusted input](../operations/untrusted-input.md)).

   Dependabot stops updating the two packages. An `ignore` entry also
   stops its security updates for them. So the issue is their notice,
   hence daily, with Dependabot's alerts, which an `ignore` entry
   doesn't stop. GitHub turns a public repository's scheduled workflows
   off after 60 days without activity. A dormant widget then keeps only
   the alerts, and the docs say to turn the workflow back on. The catalog
   needs none of this: it takes the SDK from the workspace.
4. **Releasing is one command, never a direct push.** In a widget
   repository, `pnpm release <patch|minor|major>`, run on a branch from
   `dev`:
   - writes the version and the `CHANGELOG.md` entry (from `origin/main`
     to that branch, as now);
   - commits on a branch `release/v<version>`;
   - opens its pull request into `dev`.

   Once that is merged, the `dev` → `main` pull request is the release,
   and `dev` stays level with `main` apart from the merge commit, as
   today. The same flow serves a person and an agent. The deploy's reset of `dev` after a repository's first
   release, a direct push, is reviewed in the same change.
5. **The six reference repositories stay for now, as the external
   widgets of record.** They keep their place in the real-widgets job: every SDK or
   CLI change is checked against them with the packed builds, and they
   move onto each SDK release (`upgrade-reference-widgets`). A release of
   theirs is the maintainer's go. They are also the first to take
   decisions 1 to 4, through `upgrade`, before anyone else's widget does.
   This amends ADR 0011: they are not deleted, and the real-widgets job
   doesn't move onto the catalog widgets, which build against the
   workspace and so can't test the external path.

   If they are ever retired, what replaces them has to test that path:
   for example, fixtures scaffolded from the published release and
   upgraded to the packed build on every change, one for each declaration
   form (`GRIST_OPTIONS`, `defineGristWidget`, a widget with settings).
   That replacement runs green for a release before the first of them is
   deleted.

## Consequences

- **The order of the work** (`TODO.md`, one item for each). Each step
  that changes the CLI or the template reaches the six through `upgrade`
  before anyone else's widget:
  1. the catalog's "Unreleased widget changes" pull request (decision 2):
     it stays in this repository's `scripts/` and `.github/`, needs no
     change to the CLI, and would have shown #135's fix as unreleased the
     day #136 merged;
  2. the checks in the CLI (decision 1);
  3. the external release check (decision 2), with those checks;
  4. the `update` command and its daily notice (decision 3);
  5. the release command (decision 4).
- `release-widgets` loses its step 1, which becomes the scheduled job, and
  its step 5, which becomes the check after the deploy.
  `upgrade-reference-widgets` shrinks to running `update` in each of the
  six, then merging each pull request once it is green.
- A widget repository's CI gets slower: a real Grist in Docker adds a few
  minutes, on the `dev` → `main` pull request at least.
- The docs pages for upgrading and releasing a widget
  (`apps/www/content/docs/cli/`) change with decisions 3 and 4, and each
  template change carries its "Existing widgets can …" changeset.
- The pages that followed ADR 0011 change with this record:
  `docs/architecture.md` and `docs/planning/2026-11-15-plan-0.8.md`.
  ADR 0011's status is "amended by 0026": its deletion of the six is set
  aside for now (decision 5). The six keep their entries
  in the registry, which moves with awesome-grist-widgets into this
  repository in M7. The real-widgets job then reads them from there:
  `REGISTRY_URL` in `scripts/real-widgets/list-widgets.mjs` changes in
  the same step, since an archived list would stop changing without a
  sign. The news feed stays one of the six. Its catalog entry
  is still open, as ADR 0011 left it.
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
- **Replace the six with fixtures now.** Fixtures can cover each
  declaration form on purpose, but they are not widgets anyone uses. The
  six are real code, with the upkeep of six products: Dependabot, releases,
  and the hours that went into them on 2026-11-27. The maintainer chose to
  keep them for now, and decisions 1 to 4 reduce that upkeep. Fixtures stay
  the way to retire them (decision 5).
- **Fail a catalog pull request whose change reaches a widget's build.**
  Every SDK pull request would have to release up to sixteen widgets, and
  `widgets-dist` would grow with each one.
