---
"grist-widget-sdk": patch
---

`gristAddTableAction(tableId, columns)` takes the new table's columns as a list (`[{ id: "Title", type: "Text" }]`), which is what Grist's AddTable and the emulator apply. It was typed as an object, which made the right call fail to type-check and the wrong one fail in Grist. Existing widgets that passed an object pass the list of columns instead.
