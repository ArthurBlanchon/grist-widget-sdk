---
"grist-widget-sdk": patch
---

A ChoiceList whose first choice is `"E"` (a grade, say) now reads as its choices. Typed reads took the decoded `["E", "M"]` for Grist's encoded formula error, `["E", name, …]`. So `mappedRecord` gave `null` for that cell, and `cellIssues` reported "formula error (M)".

What changes:
- **`{ encoded: false }`,** which `useGrist()` uses: an array is a list. A formula error is a `RaisedException`, the form Grist decodes one to, or `decodeGristValue`'s `{ __error: true }`, the form `fetchRows(..., { columns })` gives.
- **The emulator** now decodes a stored `["E", …]` cell into a `RaisedException` in section reads, as Grist does. In a test, a formula error in `w.record` is therefore no longer an array, and `isGristCellError` doesn't match it.
- **A RefList's display helper** is stored as `["L", ...labels]`, as Grist stores it.
