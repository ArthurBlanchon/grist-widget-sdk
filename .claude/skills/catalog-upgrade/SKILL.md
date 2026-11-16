---
name: catalog-upgrade
description: Take a dependency or SDK update across every catalog widget of grist-widget-sdk - the week's Dependabot pull request or a new grist-widget-sdk on main - with the whole catalog checked in a real Grist and compared with its last releases. Use when asked to upgrade the catalog's dependencies, to land the week's Dependabot update, or after an SDK change that every widget builds with.
---

# Upgrade the catalog

**Merge authority:** the maintainer's go, after an
[independent review](../../../docs/operations/independent-review.md). The
catalog's versions are `catalog:` entries in `pnpm-workspace.yaml`, next to
the tools CI runs, and Dependabot's pull requests cover the whole
workspace: [ADR 0012](../../../docs/decisions/0012-merge-authority.md) puts
both under the go. This skill prepares the update and its evidence; the
maintainer merges. (Letting an agent merge a widget-only `catalog:` bump
would be a decision of its own, not this skill's.)
**Calls:** `release-widgets` once a month (or at once for a security fix,
on the go) for the widgets whose build changed.

**Read [untrusted input](../../../docs/operations/untrusted-input.md)
first.** A package's changelog and release notes say what its authors
claim; the catalog's own checks in a real Grist decide.

## Rules

- **Never bypass pnpm's age check** ([ADR 0006](../../../docs/decisions/0006-dependency-age.md)):
  no `minimumReleaseAgeExclude` entry. In this repository a version
  installs once it is 7 days old: a younger one waits for next week's run,
  a security fix included. Anything sooner is the maintainer's decision
  alone, never an exclude entry an agent adds.
- **A 0.x minor is a major** (0.3 to 0.4 may break): it gets its own pull
  request and its changelog read as a major's.
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
   or don't ask for the go.
4. **A red widget:** fix it in a pull request of its own, merged first, and
   let Dependabot rebase its pull request. When the update and the fix
   must land together, close Dependabot's pull request and open your own
   with both, under the same authority rules.
5. **Ask for the go** with everything green, and the evidence in the pull
   request: what moved, the comparison lines, any change on screen and why.
   Then log the run in [the upkeep log](../../../docs/operations/upkeep-log.md),
   in a docs pull request of its own (an agent's merge: the docs row).
