---
name: catalog-upgrade
description: Take a dependency or SDK update across every catalog widget of grist-widget-sdk - the week's Dependabot pull request or a new grist-widget-sdk on main - with the whole catalog checked in a real Grist and compared with its last releases. Use when asked to upgrade the catalog's dependencies, to land the week's Dependabot update, or after an SDK change that every widget builds with.
---

# Upgrade the catalog

**Merge authority:** a patch or minor update, the agent once green; a
major, the maintainer's go after an independent review
([ADR 0012](../../../docs/decisions/0012-merge-authority.md)). A security
fix also needs the go, and goes first.
**Calls:** `release-widgets` once a month (or at once for a security fix)
for the widgets whose build changed.

## Rules

- **Never bypass pnpm's age check** ([ADR 0006](../../../docs/decisions/0006-dependency-age.md)):
  no `minimumReleaseAgeExclude` entry to get an install green. A version
  too young waits a day.
- **One pull request a week** for the catalog's routine updates (the
  `routine` Dependabot group). A major, or a group that has to move
  together (`vite` and `@vitejs/*`), gets its own.
- **No widget version is raised here.** An update changes a widget only
  when it is released; `release-widgets` does that, once a month.

## Steps

1. **Read what moves:** the changelog of each package between the two
   versions, for breaking changes and security notes. A licence change
   matters too (`dist/licenses.json` and the allow list).
2. **Let CI run every widget:** a change to the lockfile runs the whole
   catalog (`scripts/ci/changes.mjs`): spec checks, typecheck, lint,
   tests, build, sizes, then each widget in a real Grist.
3. **Read the comparison with the last releases** in the `widgets` jobs'
   summaries. A routine update should leave every widget "unchanged" (the
   Gantt has a known floor of about 0.2 %, `TODO.md`). Anything else: open
   the `-diff.png`, and either fix it or say in the pull request why the
   change is right.
4. **A red widget is fixed in the same pull request,** in the widget,
   never by pinning the old version without a reason written next to the
   pin.
5. **Merge** when the table allows it and everything is green, then note in
   `TODO.md`'s Upkeep section which widgets now build differently from their
   release, for `release-widgets`.
