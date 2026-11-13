---
"create-grist-widget": minor
---

**`upgrade` rewrites the deprecated `grist-widget-sdk` names in a widget's code.** Once the template depends on `grist-widget-sdk` 0.6, `pnpm exec create-grist-widget upgrade` also migrates the widget's own files under `src/` (not the template's, not comments), where the replacement means the same:

- `useGristContext()` → `useGrist()`;
- `w.isReady` → `w.status === "ready"` (and `!w.isReady` → `w.status !== "ready"`);
- `fetchTableRows(…)` → `fetchRows(…)`, `fetchSelectedTable()` → `fetchRows({ columnar: true })`, `fetchTable(id)` → `fetchRows(id, { columnar: true })`;
- the user-action builders' imports → `grist-widget-sdk/actions`.

What it can't rewrite safely (`isAvailable`, a destructured flag, a reader called with options) it lists by file and line. Every rewrite is idempotent, and only runs in a file that imports `grist-widget-sdk`. https://gristwidgets.com/docs/cli/upgrading#deprecated-sdk-names

Existing widgets can run `upgrade` as usual after updating `create-grist-widget`, then `pnpm typecheck`.
