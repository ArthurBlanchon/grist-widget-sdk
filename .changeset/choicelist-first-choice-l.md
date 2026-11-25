---
"grist-widget-sdk": patch
---

A ChoiceList whose first choice is `"L"` now keeps it on write. `encodeGristCell`, and so `updateRecord`, `addRecord` and `mapBack`, took a list starting with `"L"` for one already encoded. A write of `["L", "M", "S"]` was stored as `["M", "S"]`, and `["L"]` as an empty list. A ChoiceList value is now always read as its choices. RefList and Attachments lists already encoded (`["L", 3]`, as the attachment helpers return them) still pass through unchanged. Code that passed an already encoded list to a ChoiceList column should pass the choices instead.
