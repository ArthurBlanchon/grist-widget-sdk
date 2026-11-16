---
"grist-widget-sdk": minor
---

`useGrist().readOnly`: `true` when Grist opened the document read-only (a viewer, view mode, a snapshot), from the `readonly=true` Grist puts in the widget's URL. Writes (`table`, `getTable`, `applyActions`, `updateRecord`, `addRecord`, `uploadAttachment`) are then refused without reaching Grist, with its "No write access"; widget options still save, as in Grist. `mountGristWidget()` shows a `read-only` alert for a widget that asks for full access. In tests, `renderWithGrist(<App />, { widget, readOnly: true })` and `createGristEmulator({ readOnly: true })` open the document read-only: `readonly=true` in the page's URL, and Grist's refusal on writes.
