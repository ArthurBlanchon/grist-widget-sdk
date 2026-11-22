---
"grist-widget-sdk": minor
---

A Settings view for every widget. Export a `Settings` component (only the fields, which write the widget's options) from `src/app/App.tsx`, and `mountGristWidget()` does the rest: Grist's creator panel shows "Open configuration" for the widget (`hasCustomOptions` defaults to `true`), the widget's own button calls `openConfiguration()`, and either opens a view that fills the widget's panel: a "Settings" header, a large "Back to widget" button, then the fields, scrolling. Escape goes back, and the widget stays mounted under it.

Grist keeps what a widget writes to its options as a draft of the section until its own Save, at the top of the section. The new `useGrist().optionsDraft` is `true` while the widget's write is that draft, and the view says to click Save then. Grist tells a widget nothing on Save: `optionsDraft` turns `false` on Grist's Revert, and when the configuration closes. On a read-only document the view says the settings can't be kept. The chrome speaks English and French ("Revenir au widget": Grist's French interface uses "Retour" for Revert).

Existing widgets that draw their own configuration keep working. They can move its fields into an exported `Settings` and drop their own view, their own Save button and their own reminder.
