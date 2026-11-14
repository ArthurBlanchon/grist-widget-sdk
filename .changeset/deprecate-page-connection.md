---
"grist-widget-sdk": minor
"create-grist-widget": minor
---

0.7 deprecates what 1.0 removes from the connection (see [Deprecated names](https://gristwidgets.com/docs/sdk/api/deprecated) and the new [versioning policy](https://gristwidgets.com/docs/sdk/api/versioning)). Each keeps working, and warns once in development:

- `useGrist()` outside `<GristWidgetProvider>`, the page-wide connection. Inside Grist, `mountGristWidget()` renders the provider; in a test, pass the declaration, `renderWithGrist(<App />, { widget })`; a component that also runs outside Grist calls `useGristOptional()`.
- `useGrist(options)`: declare the options with `defineGristWidget()` and call `widget.useGrist()`. Inside a provider they were already ignored.
- `useGristSchema()`'s connection options (`requiredAccess`, `columns`, `allowSelectBy`, `hasCustomOptions`, `onEditOptions`): declare them with `defineGristWidget()`.

The types public signatures use are now exported from `grist-widget-sdk`: `GristApi`, `GristCellCheck` (what `checkGristCell` returns), `GristColumnExcludeContext`, `GristDecodedValue`, `GristEncodedError`, `GristEncodedAttachmentList`, `GristMinimalRecord`, `GristReplicaSelection`, `GristTableNewRecord`, `GristTableOpOptions`, `GristTableUpdateRecord`, `GristTableUpsertOptions`, `GristTableUpsertRecord`, `GristWidgetConfiguration` and `GristWidgetLinkingInfo`.

`create-grist-widget upgrade` lists, by file and line, each `useGrist(options)`, each `useGristSchema()` given connection options, and each `renderWithGrist(ui)` without `widget`, test files included. Existing widgets can run `pnpm exec create-grist-widget upgrade` after moving to this release and change what it lists by hand; until 1.0 nothing breaks.
