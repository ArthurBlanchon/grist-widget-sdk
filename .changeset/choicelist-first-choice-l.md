---
"grist-widget-sdk": minor
---

A ChoiceList whose first choice is `"L"`, a size for example, now keeps that choice when it is read and when it is written. Until now:
- **Writes.** `encodeGristCell`, and so `updateRecord`, `addRecord` and `mapBack`, took a list starting with `"L"` for one already encoded. A write of `["L", "M", "S"]` was stored as `["M", "S"]`, and `["L"]` as an empty list.
- **Reads.** `mappedRecord` read Grist's decoded `["L", "M"]` as `["M"]`.

What changes:
- **`encodeGristCell`.** A ChoiceList value is now always read as its choices. That changes its "already encoded passes through" contract for ChoiceList: code that passed an encoded list to a ChoiceList column should pass the choices instead. RefList and Attachments lists already encoded (`["L", 3]`, as the attachment helpers return them) still pass through, also for a type that accepts a ChoiceList too.
- **`checkGristCell` takes `{ encoded }`.**
  - `false` is the decoded form, which `useGrist()` now uses.
  - `true` is the stored form, which `fetchRows(tableId)` returns.
  - Without it, a list starting with `"L"` is still taken as encoded.
- **The emulator.** It now decodes lists in section reads as Grist does, and `docApi.fetchTable` keeps the stored form. A test that read `["L", ...]` from `w.records` now reads the items.
