---
"grist-widget-sdk": minor
---

A declared reference column reads as its row id, whatever its column shows. A widget that declares a column as `Ref:<table>` or `RefList:<table>`, with no `Text` alternative, now asks Grist for row ids (`expandRefs: false`). Its `mappedRecord` then holds the id in place of `null` and a "not a reference" issue for a column that shows a name. A column that shows a number is no longer mistaken for the row id. Every reference in its `w.record` and `w.records` is an id too. Widgets that declare no reference, or declare `"Text,Ref"` to read the name, read as before. The emulator applies a subscriber's own read options (`keepEncoded`, `expandRefs`) to the records it pushes, as Grist does. It also refuses `docApi.fetchTable` below full access, with Grist's "Access not granted": a test that read a whole table with `read table` access now fails as the widget would in Grist, so give it `requiredAccess: "full"`.
