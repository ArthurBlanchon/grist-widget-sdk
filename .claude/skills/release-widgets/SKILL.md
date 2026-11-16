---
name: release-widgets
description: Release the catalog widgets of grist-widget-sdk whose code or build changed since their last release - the versions raised, the changelogs written, one pull request, then each release checked live on its channels. Use for the monthly widget release, at once for a security fix, or when asked to release, publish or ship catalog widgets.
---

# Release catalog widgets

**Merge authority:** patches and minors, the agent once green; a major (a
column removed, renamed or retyped, a higher access, a new outbound host,
options read differently), the maintainer's go
([ADR 0012](../../../docs/decisions/0012-merge-authority.md)). If in doubt
between a minor and a major, it is a major.
**Calls:** nothing; `catalog-upgrade` and `fix-issue` leave the work this
skill releases.

A widget's merge is its release: on `main`, the release job builds each
version `widgets-dist` doesn't have, once, for good
([ADR 0009](../../../docs/decisions/0009-install-urls.md), [ADR 0013](../../../docs/decisions/0013-widget-channels.md),
`scripts/widgets/dist.mjs`).

## Steps

1. **Find what changed since each release.** For each widget, the release's
   commit is in `widgets-dist/<slug>/<version>/release.json` (`commit`):
   `git diff <commit> -- widgets/<slug> widgets/_shared pnpm-lock.yaml`.
   A widget with no change stays where it is.
2. **Choose each version** from the person's side (`widgets/AGENTS.md`,
   Releasing): a fix or a dependency update is a patch, a new option or
   behaviour a minor, anything that breaks a document using it a major.
3. **Write each changelog entry** on top of the widget's `CHANGELOG.md`:
   `## x.y.z (date)`, then what changed for the people using it, in their
   words (not "bumped deps": "the map loads faster", or "security fixes in
   the libraries it uses").
4. **One pull request** with every widget released this time. Its body lists
   the widgets, their versions and why. CI checks them all in a real Grist
   and compares each with its last release: read those lines, and say for
   every change on screen whether it is intended.
5. **After the merge, check each release is served** on both origins:
   `/widgets/<slug>/<version>/` answers 200, `/widgets/<slug>/v<major>/`
   and `/latest/` serve it, the catalog (`widgets.json`) lists the version,
   and the widget's page shows its changelog entry. A version that isn't
   there after the deploy is a red release: read `docs/operations/site-deploy.md`.
