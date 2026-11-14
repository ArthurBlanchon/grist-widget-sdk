---
"grist-widget-sdk": patch
---

`mountGristWidget()`'s default alerts no longer remount the widget when an alert comes or goes. A failed write, or a column mapping being changed, used to reset the widget's state: a half-typed form, an open menu. The widget now keeps its place in the tree, alerts or not.
