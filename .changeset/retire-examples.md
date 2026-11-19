---
"create-grist-widget": minor
---

Every widget starts from the template. `create-grist-widget list`, `use` and `create --example` are retired: they exit with a pointer to the catalog, https://gristwidgets.com/widgets/ (`--example blank` still means the template). Options also read the `--name=value` form. Read a catalog widget's spec, code and tests there for a pattern close to yours, and adapt it in `src/app/`. The package no longer embeds the example widgets. The template's `AGENTS.md` gains a "Patterns to start from" section naming catalog widgets for common patterns. Existing widgets can get it with `pnpm exec create-grist-widget upgrade`.
