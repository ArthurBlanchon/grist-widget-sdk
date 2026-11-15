---
"grist-widget-sdk": patch
---

The emulator refuses a write to a column the table doesn't have, with Grist's "Invalid column" error, instead of adding the column. A widget's test now sees the failure the widget would meet in Grist. A table declared with no columns still takes the columns of the rows written to it.
