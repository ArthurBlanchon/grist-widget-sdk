---
"grist-widget-sdk": minor
---

A widget's configuration view, opened from Grist or from the widget. `useGrist()` gains `configurationOpen`, `openConfiguration()` and `closeConfiguration()`. With `hasCustomOptions: true` in the declaration, Grist's creator panel shows "Open configuration" for the widget: clicking it turns `configurationOpen` to `true`, and `openConfiguration()` does the same from the widget's own settings icon, so both open one view, which the widget draws (with a close button, Escape and Cancel to leave it). A widget's own `onEditOptions` is still called, after the state turns `true`.

Grist shows the button only when the widget hands it an `onEditOptions`: until now, `hasCustomOptions: true` alone showed none. The SDK now hands it one whenever `hasCustomOptions` is `true`. The emulator follows Grist (no `onEditOptions`, no button), and `emulator.openConfiguration()` clicks the button in a test; it throws for a widget that declared no `hasCustomOptions`.

Existing widgets that set `hasCustomOptions: true` and opened their settings from `onEditOptions` keep working; they can read `configurationOpen` instead of keeping that state themselves. A widget that set `hasCustomOptions: true` without an `onEditOptions` had no button in Grist, and now has one that does nothing until it draws a view on `configurationOpen`: draw one, or drop the flag.
