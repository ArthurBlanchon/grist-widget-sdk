---
name: upgrade-reference-widgets
description: Move the six reference widgets (gantt-widget, news-feed-widget, ask-ai-widget, world-map, create-email-draft, scan-with-ai) onto a new grist-widget-sdk / create-grist-widget release on their dev branches, with the template's files upgraded. Use after a release, or when asked to update, upgrade or bump the reference widgets.
---

# Upgrade the reference widgets

They live in their own repositories under `ArthurBlanchon/`. Each one
follows its own `AGENTS.md`: develop on `dev`, and release by merging `dev`
into `main`.

Rules:
- **Never bypass pnpm's age check.** A version installs once it is
  24 hours old. Never add a `minimumReleaseAgeExclude` entry, and never
  delete the ones pnpm wrote on release day
  ([ADR 0006](../../../docs/decisions/0006-dependency-age.md)).
- **One pull request per widget, into `dev`.** Merge it when it is green.
- **`main` (production) only on the maintainer's go.**
- **Leave the widgets' own Dependabot pull requests alone,** and list them
  in your report.

For each widget, on a branch from `dev`:

1. **Bump both packages** to the release (`^x.y.z`) in `package.json`, run
   `pnpm install`, and commit.
2. **Upgrade the template's files** and commit the result:

   ```bash
   pnpm exec create-grist-widget upgrade
   ```

   It rewrites only the template's files, plus the SDK names a release
   renamed, and lists by file and line what it could not rewrite. Fix
   each listed use by hand.
3. **Check:**

   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```

   Then, from this repository, check the widget in a real Grist:

   ```bash
   CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e:grist <widget dir>
   ```

4. **Open the pull request into `dev`.** Wait for its `ci.yml` to pass,
   then merge it.

Then re-run this repository's real-widgets job on any SDK pull request
that was waiting on the widgets, and report, per widget: the pull request,
its checks, the hints fixed by hand, and the Dependabot pull requests left
open.

A widget release (`pnpm release <patch|minor|major>` on `dev`, then
`dev` → `main`) only happens when the maintainer asks for it.
