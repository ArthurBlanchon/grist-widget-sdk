---
"grist-widget-sdk": minor
"create-grist-widget": minor
---

Demo data (`GristWidgetDemo`) takes an `Attachments` column, its cells lists of file names in `src/app/demo/` that the demo document gets as attachments; a `RefList:<table>` column, its cells lists of row positions; and `choiceColors`: each choice's `fillColor` and `textColor`, as Grist shows them. `demo` and `demo --save` no longer leave the new document's empty `Table1` next to the widget's tables, and a reference whose table comes later in the demo works.
