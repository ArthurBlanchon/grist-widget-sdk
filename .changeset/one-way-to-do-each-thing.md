---
"grist-widget-sdk": minor
"create-grist-widget": patch
---

**One way to do each thing: `fetchRows()`, `grist-widget-sdk/actions`, and soft deprecations.**

```ts
const rows = await w.fetchRows()                       // the section's rows, in its order
const people = await w.fetchRows("People")             // any table's rows (full access)
const columns = await w.fetchRows({ columnar: true })  // Grist's own column-oriented payload

import { gristAddColumnAction } from "grist-widget-sdk/actions"
```

- `useGrist().fetchRows(tableId?, options?)` replaces three readers. Without a table id it reads the widget's own section (filters and sort applied); with one, any table, in Grist's order (`order`, `columns` as before). Rows by default, `{ columnar: true }` for columns.
- `grist-widget-sdk/actions` is the user actions' own entry point, with the bulk record builders (`gristBulkAddRecordAction`, `gristBulkUpdateRecordAction`, `gristBulkRemoveRecordAction`) the root entry never exported.
- Deprecated, removed in 1.0: `useGristContext()` (use `widget.useGrist()` or `useGrist()`); `useGrist().isReady` and `isAvailable`, and `useGristSchema().isAvailable` (use `status`); `fetchSelectedTable`, `fetchTable` and `fetchTableRows` (use `fetchRows`); the nine user-action builders in the root entry (import them from `grist-widget-sdk/actions`). Each still works, is struck through in the editor (`@deprecated`), and warns once in development with what replaces it; a production build stays silent. https://gristwidgets.com/docs/sdk/api/deprecated lists them.
- The examples (`create-grist-widget --example`) are declared with `defineGristWidget()` and use none of the deprecated names.

Existing widgets keep working unchanged. To clear the warnings, replace each name as the deprecations page says.
