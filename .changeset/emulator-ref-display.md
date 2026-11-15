---
"grist-widget-sdk": patch
---

The emulator sends a reference as Grist does: in `w.record`, `w.records` and the selected table, a Ref cell is the text its column shows (from its display helper or its visible column), and a RefList the list of those; a reference showing the row id stays the id. `fetchRows(tableId)` keeps the row ids. A test that read a row id from a Ref cell passed where the widget, in Grist, got a name: read the ids with `fetchRows(tableId)`.
