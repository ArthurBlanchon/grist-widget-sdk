---
"grist-widget-sdk": patch
---

**`mountGristWidget(entry)` and `smokeTestWidget(entry)` read an entry module that also exports its component as `App`.** A widget whose `src/app/App.tsx` has `export function App()` next to `export default App` was taken for the older `{ App, options }` form: `mountGristWidget(entry)` (the 0.5 template's `src/main.tsx`) mounted it without its `GRIST_OPTIONS` (no declared columns, no access level), and `smokeTestWidget(entry)` threw. An entry module is now recognised by its default export.

Existing widgets: nothing to do. A widget on `create-grist-widget` 0.5.0's template with a named `App` export gets its declaration back once this version is installed.
