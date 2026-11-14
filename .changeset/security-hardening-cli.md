---
"create-grist-widget": patch
---

**Hardened workflows and commands.** The template's workflows pin every GitHub Action to a commit SHA (with the version in a comment, which Dependabot keeps up to date) instead of a movable tag, and the pull request check no longer leaves the repository token in `.git/config`. On Windows, where package managers start through a shell, the CLI now refuses to pass anything but a plain word (a package name, a flag) as an argument, and `upgrade` only looks up `minimumReleaseAgeExclude` entries that are npm package names.

Existing widgets can run `pnpm exec create-grist-widget upgrade` (after updating `create-grist-widget`) to get the pinned workflows.
