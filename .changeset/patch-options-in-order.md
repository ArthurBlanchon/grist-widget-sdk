---
"grist-widget-sdk": patch
---

`patchWidgetOptions()` applies patches one at a time. Two patches made together (a widget saving two settings at once) used to read the same options, and the second overwrote the first; both now land.
