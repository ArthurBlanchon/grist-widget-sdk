---
"create-grist-widget": patch
---

The template's deploy workflow says why its publish and cleanup jobs keep the checkout's credentials (they push the `gh-pages` branch), in the form zizmor, the GitHub Actions security linter, reads. Nothing changes in how a widget deploys.

Existing widgets can run `pnpm exec create-grist-widget upgrade` after moving to this release to get the same comments; nothing else to do.
