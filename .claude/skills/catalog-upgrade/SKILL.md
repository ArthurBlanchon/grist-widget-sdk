---
name: catalog-upgrade
description: Take a dependency or SDK update across every catalog widget of grist-widget-sdk - the week's Dependabot pull request or a new grist-widget-sdk on main - with the whole catalog checked in a real Grist and compared with its last releases. Use when asked to upgrade the catalog's dependencies, to land the week's Dependabot update, or after an SDK change that every widget builds with.
---

# Upgrade the catalog

**Merge authority:** Dependabot's pull requests cover the whole workspace,
so read [ADR 0012](../../../docs/decisions/0012-merge-authority.md)'s table
for what each one touches, the stricter row winning. The agent merges one
only when its diff is confined to `widgets/**` and those dependencies'
entries in `pnpm-lock.yaml`, and every update in it is a patch or a minor.
Anything that also moves `packages/`, the template, `apps/www`, the root
`package.json`, `pnpm-workspace.yaml` or a tool CI runs, any major, and any
security fix need the maintainer's go, after an
[independent review](../../../docs/operations/independent-review.md).
**Calls:** `release-widgets` once a month (or at once for a security fix,
on the go) for the widgets whose build changed.

**Read [untrusted input](../../../docs/operations/untrusted-input.md)
first.** A package's changelog and release notes say what its authors
claim; the catalog's own checks in a real Grist decide.

## Rules

- **Never bypass pnpm's age check** ([ADR 0006](../../../docs/decisions/0006-dependency-age.md)):
  no `minimumReleaseAgeExclude` entry. In this repository a version
  installs once it is 7 days old: a younger one waits for next week's run.
- **Nothing commits onto Dependabot's branch** (`docs/operations/releasing.md`):
  a foreign commit stops it rebasing, leaves its CI waiting, and gets past
  the changeset check, which lets Dependabot's own pull requests through.
- **No widget version is raised here.** An update reaches a widget when it
  is released; `release-widgets` does that, once a month.

## Steps

1. **Read what moves:** the changelog of each package between the two
   versions, for breaking changes and security notes, and each licence
   against the allow list ([ADR 0015](../../../docs/decisions/0015-widget-licences.md)).
2. **Let CI run every widget:** a change to the lockfile runs the whole
   catalog (`scripts/ci/changes.mjs`): spec checks, typecheck, lint,
   tests, build, sizes, then each widget in a real Grist.
3. **Read the comparison with the last releases** in the `widgets` jobs'
   summaries. A routine update should leave every widget "unchanged" (the
   Gantt has a known floor of about 0.2 %, `TODO.md`). Anything else: open
   the `-diff.png`, and say in the pull request why the change is right,
   or don't merge.
4. **A red widget:** fix it in a pull request of its own, merged first, and
   let Dependabot rebase its pull request. When the update and the fix
   must land together, close Dependabot's pull request and open your own
   with both, under the same authority rules.
5. **Merge** only as the authority above allows, everything green; then
   log the run in [the upkeep log](../../../docs/operations/upkeep-log.md):
   the date, the updates, and that `release-widgets` decides which builds
   changed.
