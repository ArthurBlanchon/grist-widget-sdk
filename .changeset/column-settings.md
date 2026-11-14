---
"grist-widget-sdk": minor
---

`listColumns()` now gives each column's settings as `widgetOptions` (a Choice column's `choices`, a date's format…) and, for a Ref or RefList column, the referenced table's column its cells show as `visibleCol`. A widget can build a typed form from them: a choice list for a Choice column, a picker of the referenced rows for a Ref.
