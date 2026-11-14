---
"grist-widget-sdk": minor
"create-grist-widget": minor
---

0.7 removes the names 0.6 deprecated, and the page-wide connection. Before 1.0 a minor can break a widget; from 1.0 a name is deprecated for at least one minor first (the new [versioning policy](https://gristwidgets.com/docs/sdk/api/versioning)).

- `useGrist()` needs `<GristWidgetProvider>`, and throws outside one. Inside Grist, `mountGristWidget()` renders the provider; in a test, pass the declaration, `renderWithGrist(<App />, { widget })`; a component that also runs outside Grist calls `useGristOptional()`, which returns `null` there.
- `useGrist()` takes no options: declare them with `defineGristWidget()` and call `widget.useGrist()`.
- `useGristSchema()` takes its schema options only: `requiredAccess`, `columns`, `allowSelectBy`, `hasCustomOptions` and `onEditOptions` go in `defineGristWidget()`. Its `isAvailable` is gone: read `useGrist().status`.
- `useGristContext()` is gone: call `widget.useGrist()` or `useGrist()`.
- `useGrist().isReady`, `isAvailable`, `fetchSelectedTable`, `fetchTable` and `fetchTableRows` are gone: `status === "ready"`, `status`, and `fetchRows()` (`{ columnar: true }` for columns).
- The user-action builders (`gristAddRecordAction`, …) are only in `grist-widget-sdk/actions`.

The types public signatures use are now exported from `grist-widget-sdk`: `GristApi`, `GristCellCheck` (what `checkGristCell` returns), `GristColumnExcludeContext`, `GristDecodedValue`, `GristEncodedError`, `GristEncodedAttachmentList`, `GristMinimalRecord`, `GristReplicaSelection`, `GristTableNewRecord`, `GristTableOpOptions`, `GristTableUpdateRecord`, `GristTableUpsertOptions`, `GristTableUpsertRecord`, `GristWidgetConfiguration` and `GristWidgetLinkingInfo`.

Existing widgets run `pnpm exec create-grist-widget upgrade` after moving to this release: it rewrites the renamed names in `src/` and lists by file and line, test files included, what to change by hand (each `useGrist(options)`, each `useGristSchema()` given connection options, each `renderWithGrist(ui)` without `widget`). `pnpm typecheck` then shows anything left.
