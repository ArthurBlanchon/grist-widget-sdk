---
"create-grist-widget": patch
---

The template's `AGENTS.md` names the `Settings` export: a widget with settings exports its fields from `src/app/App.tsx`, and Grist's "Open configuration" (or `w.openConfiguration()` from the widget's own button) opens the SDK's Settings view. Existing widgets get it with `pnpm exec create-grist-widget upgrade`, which rewrites `AGENTS.md`.
