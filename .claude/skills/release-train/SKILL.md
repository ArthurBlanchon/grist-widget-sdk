---
name: release-train
description: Prepare and run the weekly npm release of grist-widget-sdk and create-grist-widget (the Version Packages pull request), or an out-of-band security release. Use when asked to release, cut the weekly train, publish to npm, or merge the Version Packages PR.
---

# The weekly release train

Background: [`docs/operations/releasing.md`](../../../docs/operations/releasing.md)
and [ADR 0004](../../../docs/decisions/0004-release-train.md).

Publishing needs the maintainer. They merge the Version Packages pull
request, or tell you to, and the `npm` environment only runs on `main`.
Never publish by hand, and never add a token to make a bot push run CI.

1. **Check what the release carries.** Open the "Version Packages" pull
   request and read its changelog entries as a widget owner would: each
   one says what changed and, for the template, what an existing widget
   has to do. Fix a wrong entry in its `.changeset/*.md`, in a pull
   request into `main`.
2. **Add the routine changeset for Dependabot updates,** if any reached a
   published package:

   ```bash
   node scripts/release/routine-changeset.mjs           # dry run: what it would write
   node scripts/release/routine-changeset.mjs --write   # .changeset/routine-dependencies.md
   ```

   Commit it in a pull request into `main`. Once it merges, the Version
   Packages pull request includes it.
3. **Get the Version Packages pull request green.** Its CI runs wait for
   approval, because it was pushed with `GITHUB_TOKEN`: ask the maintainer
   to approve them, or re-run them from the Actions tab if you can.
4. **Ask the maintainer to merge it,** unless they already told you to.
   The release job then publishes both packages over OIDC and tags them.
5. **Verify:**

   ```bash
   npm view grist-widget-sdk version
   npm view create-grist-widget version
   ```

   The template canary (`.github/workflows/template-canary.yml`) runs on
   the tagged commit, and the site-headers check runs after the deploy.
   Both must be green.
6. **A day later,** once pnpm's 24-hour age check allows it, move the
   reference widgets onto the release: the `upgrade-reference-widgets`
   skill.

A security fix skips the weekly wait: steps 1 to 5 as soon as the fix is
merged.
