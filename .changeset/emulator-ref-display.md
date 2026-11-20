---
"grist-widget-sdk": minor
---

The emulator sends a reference as Grist does: in `w.record`, `w.records` and the selected table, a Ref cell is the text its column shows (from its display helper or its visible column), and a RefList the list of those; a reference showing the row id stays the id. `fetchRows(tableId)` keeps the row ids; `expandRefs: false`, or `cellFormat: "typed"`, sends the ids, as in Grist. A test that read a row id from a raw Ref cell passed where the widget, in Grist, got a name: declare the column `Ref:<table>`, which reads row ids (see the entry on declared references), or read them with `fetchRows(tableId)`, with full access.
