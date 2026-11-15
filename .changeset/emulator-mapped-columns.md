---
"grist-widget-sdk": patch
---

The emulator sends a mapped widget only its mapped columns, as Grist does: once a widget declares columns (even none) and a mapping is set, `w.record`, `w.records` and the selected table hold the mapped columns and the row id, nothing else; `fetchRows(tableId)` still reads every column. A test that read an unmapped column from `w.record` passed where the widget, in Grist, got nothing: read such columns with `fetchRows(tableId)` (full access), or declare no columns.
