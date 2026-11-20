---
"grist-widget-sdk": patch
---

A column declared with a table or a zone (`"Ref:People"`, `"RefList:Tags"`, `"DateTime:Europe/Paris"`) can be mapped in Grist. Grist offers a column for mapping when its base type (`Ref`, `RefList`, `DateTime`) is declared, so it offered none for such a declaration, and dropped a mapping made before. The SDK now hands Grist each type's base, and keeps the full type for its own reads and checks. The emulator's mappings follow Grist's: every declared column, `null` when unmapped, and a column the table lacks or whose base type the declaration doesn't accept left out. A test that mapped such a column now fails as the widget would in Grist.
