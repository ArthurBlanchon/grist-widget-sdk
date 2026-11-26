---
"grist-widget-sdk": patch
---

A ChoiceList whose first choice is `"E"` (a grade, say) now reads as its choices. Typed reads took the decoded `["E", "M"]` that Grist sends for a formula error, `["E", name, …]`. So `mappedRecord` gave `null` for that cell, and `cellIssues` reported "formula error (M)". With `{ encoded: false }`, which `useGrist()` uses, only a `RaisedException` is a formula error, the form Grist decodes one to. The emulator now decodes a stored `["E", …]` cell into one too, as Grist does.
