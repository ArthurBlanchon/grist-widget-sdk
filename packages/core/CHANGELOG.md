# grist-widget-sdk

## 0.8.0

### Minor Changes

- a42a774: `gristAddTableAction(tableId, columns)` takes the new table's columns as a list (`[{ id: "Title", type: "Text" }]`), which is what Grist's AddTable and the emulator apply. It was typed as an object, which made the right call fail to type-check and the wrong one fail in Grist. Existing widgets that passed an object pass the list of columns instead.
- b408e9e: A ChoiceList whose first choice is `"L"`, a size for example, now keeps that choice when it is read and when it is written. Until now:
  - **Writes.** `encodeGristCell`, and so `updateRecord`, `addRecord` and `mapBack`, took a list starting with `"L"` for one already encoded. A write of `["L", "M", "S"]` was stored as `["M", "S"]`, and `["L"]` as an empty list.
  - **Reads.** `mappedRecord` read Grist's decoded `["L", "M"]` as `["M"]`.
  
  What changes:
  - **`encodeGristCell`.** A ChoiceList value is now always read as its choices. That changes its "already encoded passes through" contract for ChoiceList: code that passed an encoded list to a ChoiceList column should pass the choices instead. RefList and Attachments lists already encoded (`["L", 3]`, as the attachment helpers return them) still pass through, also for a type that accepts a ChoiceList too.
  - **`checkGristCell` takes `{ encoded }`.**
    - `false` is the decoded form, which `useGrist()` now uses.
    - `true` is the stored form, which `fetchRows(tableId)` returns without `columns`.
    - Without it, a list starting with `"L"` is still taken as encoded.
  - **The emulator.** It now decodes lists in section reads as Grist does, and `docApi.fetchTable` keeps the stored form. A test that read `["L", ...]` from `w.records` now reads the items.
- 5ea42a3: The SDK's own chrome speaks the widget's language. `defineGristWidget({ languages: ["en", "fr"] })` says which languages a widget is written in. The screens before the widget renders, the alerts above it, "Report a problem" and "The widget stopped working" then take the first of the person's browser languages that the widget declares and the SDK speaks (English and French). The French quotes Grist's own French labels. A widget that declares no `languages` keeps English chrome, as before. Existing widgets that ship French can add `languages: ["en", "fr"]` to their declaration.
- 9fce279: A widget's configuration view, opened from Grist or from the widget. `useGrist()` gains `configurationOpen`, `openConfiguration()` and `closeConfiguration()`. With `hasCustomOptions: true` in the declaration, Grist's creator panel shows "Open configuration" for the widget: clicking it turns `configurationOpen` to `true`, and `openConfiguration()` does the same from the widget's own settings icon, so both open one view, which the widget draws (with a close button, Escape and Cancel to leave it). A widget's own `onEditOptions` is still called, after the state turns `true`.
  
  Grist shows the button only when the widget hands it an `onEditOptions`: until now, `hasCustomOptions: true` alone showed none. The SDK now hands it one whenever `hasCustomOptions` is `true`. The emulator follows Grist (no `onEditOptions`, no button), and `emulator.openConfiguration()` clicks the button in a test; it throws for a widget that declared no `hasCustomOptions`.
  
  Existing widgets that set `hasCustomOptions: true` and opened their settings from `onEditOptions` keep working; they can read `configurationOpen` instead of keeping that state themselves. A widget that set `hasCustomOptions: true` without an `onEditOptions` had no button in Grist, and now has one that does nothing until it draws a view on `configurationOpen`: draw one, or drop the flag.
- f03e0b9: A declared reference column reads as its row id, whatever its column shows. A widget that declares a column as `Ref:<table>` or `RefList:<table>`, with no `Text` alternative, now asks Grist for row ids (`expandRefs: false`). Its `mappedRecord` then holds the id in place of `null` and a "not a reference" issue for a column that shows a name. A column that shows a number is no longer mistaken for the row id. Every reference in its `w.record` and `w.records` is an id too. Widgets that declare no reference, or declare `"Text,Ref"` to read the name, read as before. `w.fetchRows()` gives the same ids. A `"Text,Ref"` column declared next to a pure `Ref` one reads the id too, since Grist sends ids or names for the whole read, and the SDK warns about it in the console. The emulator applies a subscriber's own read options (`keepEncoded`, `expandRefs`) to the records it pushes, as Grist does. Like Grist, it now answers `docApi` calls other than `getDocName` (`fetchTable`, `listTables`, `applyUserActions`, `getAccessToken`) only with full access, failing with "Access not granted". A test that read or wrote that way with `read table` access now fails as the widget would in Grist: give the widget `requiredAccess: "full"`, or, for an emulator created without `ready()`, `createGristEmulator({ widgetInteraction: { access_level: "full" } })`.
- 940858b: Demo data (`GristWidgetDemo`) takes an `Attachments` column, its cells lists of file names in `src/app/demo/` that the demo document gets as attachments; a `RefList:<table>` column, its cells lists of row positions; and `choiceColors`: each choice's `fillColor` and `textColor`, as Grist shows them. `demo` and `demo --save` no longer leave the new document's empty `Table1` next to the widget's tables, and a reference whose table comes later in the demo works.
- bd01e2f: `parseDeployPath()` knows the widget catalog's paths: a release at `/<version>/`, and the newest release of a major at `/v<major>/`, a new channel `{ kind: "major", major }` (`deployChannelLabel()` gives `"v1"`). A `versions.json` entry may say where its release is served (`path`), and the default release page then links each major's channel and each release there. On `/dev/` the default release page no longer offers its URL to paste into Grist: it says the build follows every change before its release, and to use a released channel instead.
  
  A widget that switches over `DeployChannel`'s `kind` gets a `"major"` case to handle; nothing else changes for existing widgets.
- e1c119d: The emulator sends a mapped widget only its mapped columns, as Grist does: once a widget declares columns (even none) and a mapping is set, `w.record`, `w.records` and the selected table hold the mapped columns and the row id, nothing else; `fetchRows(tableId)` still reads every column. A test that read an unmapped column from `w.record` passed where the widget, in Grist, got nothing: read such columns with `fetchRows(tableId)` (full access), or declare no columns.
- e65deb5: The emulator sends a reference as Grist does: in `w.record`, `w.records` and the selected table, a Ref cell is the text its column shows (from its display helper or its visible column), and a RefList the list of those; a reference showing the row id stays the id. `fetchRows(tableId)` keeps the row ids; `expandRefs: false`, or `cellFormat: "typed"`, sends the ids, as in Grist. A test that read a row id from a raw Ref cell passed where the widget, in Grist, got a name: declare the column `Ref:<table>` or `RefList:<table>`, which makes every reference the widget reads a row id (the entry "A declared reference column reads as its row id"), or read them with `fetchRows(tableId)`, with full access.
- f8478a2: `httpUrl(value)`: a link or a source from a document's data, as an absolute `http:` or `https:` URL, or `undefined`. It refuses `javascript:`, `data:` and other schemes, relative URLs, and credentials that disguise the host (`https://bank.example@evil.example`). Pass every URL that comes from a cell through it before it reaches an `href` or a `src`.
- 538dc6c: The linking alerts show only for a widget that says it needs the link. `defineGristWidget({ requiredLinking: "target" })` is a widget that shows the row selected in another section: `section-not-linked` shows while its section follows none. `requiredLinking: "source"`, with `allowSelectBy: true`, is a widget that is there to drive other sections: `source-not-wired` shows while none follows it. Without `requiredLinking`, neither shows. Until now they showed for every widget in a Grist that reports linking, so a widget that works on the whole table (a chart, a board) warned in any section added without "Select by", and every `allowSelectBy` widget warned until a section followed it. Both messages now say where to set the link in Grist: SELECT BY, in the panel's Data tab.
  
  The template's widget, which shows the selected row, declares `requiredLinking: "target"`.
  
  Existing widgets that show the selected row, and relied on the alert, can add `requiredLinking: "target"` to their declaration; those that drive other sections and want the alert, `requiredLinking: "source"`. Others need nothing: the alert just stops. A `suppressAlerts: ["section-not-linked"]` or `["source-not-wired"]` is no longer needed, and can go.
- cf431d7: `defineGristWidget({ optionsVersion, migrate })`: widget options that change shape between versions. The SDK keeps the version with the options (`__version`, a reserved key). Options written under an older version reach `widgetOptions` migrated by `migrate(options, fromVersion)`, each time they are read, without writing on load; the widget's writes carry the current version, a patch merging into the migrated options. Options without a version count as version 1; from version 2, `migrate` is required. Options from a newer version, or that `migrate` can't migrate, are never written over: the new `optionsIssue` says why, and `setWidgetOptions({})` resets them. A widget that declares no version reads and writes its options untouched. The `MigrateWidgetOptions` type is exported for `migrate`.
- 0751e40: `useGrist().readOnly`: `true` when Grist opened the document read-only (a viewer, view mode, a snapshot), from the `readonly=true` Grist puts in the widget's URL. Writes (`table`, `getTable`, `applyActions`, `updateRecord`, `addRecord`, `uploadAttachment`) are then refused without reaching Grist, with its "No write access"; widget options still save, as in Grist. `mountGristWidget()` shows a `read-only` alert for a widget that asks for full access. In tests, `renderWithGrist(<App />, { widget, readOnly: true })` and `createGristEmulator({ readOnly: true })` open the document read-only: `readonly=true` in the page's URL, and Grist's refusal on writes.
- d51f1d9: A widget can say where to report a problem: `defineGristWidget({ reportUrl })`, an http or https URL such as a prefilled issue form. `mountGristWidget()` links "Report a problem" under a failed write's alert, and on a new screen, "The widget stopped working", shown when the widget throws while rendering instead of a blank panel, with a button that reloads it. The error stays uncaught, so a `renderWithGrist` test of a widget that throws still fails. Nothing is sent anywhere. Existing widgets get the new screen as they are, and can add `reportUrl` to their declaration.
- 77b2fe6: A Settings view for every widget. Export a `Settings` component (only the fields, which write the widget's options) from `src/app/App.tsx`, and `mountGristWidget()` does the rest: Grist's creator panel shows "Open configuration" for the widget (`hasCustomOptions` defaults to `true`), the widget's own button calls `openConfiguration()`, and either opens a view that fills the widget's panel: a header with a "Back to widget" button on the left and the "Settings" title in the middle, then the fields, scrolling. Escape goes back, and the widget stays mounted under it.
  
  Grist keeps what a widget writes to its options as a draft of the section until its own Save, at the top of the section. The new `useGrist().optionsDraft` is `true` while the widget's write is that draft, and the view says to click Save then. Grist tells a widget nothing on Save: `optionsDraft` turns `false` on Grist's Revert, and when the configuration closes. On a read-only document the view says the settings can't be kept. The chrome speaks English and French ("Revenir au widget": Grist's French interface uses "Retour" for Revert).
  
  Existing widgets that draw their own configuration keep working. They can move its fields into an exported `Settings` and drop their own view, their own Save button and their own reminder.
- aae4e14: The public API loses three internals no widget needs: `entryProps` (`grist-widget-sdk/app`), and `resolveMappings` and `enrichEmulatorColumnMetadata` (`grist-widget-sdk/emulator`). Pass the entry module to `mountGristWidget(entry)` or `smokeTestWidget(entry)`, and read mappings with `w.mappings`. `useWidgetMetadata` is deprecated: `mountGristWidget()` already sets the page's title and meta tags from the declaration's `title` and `description`, so remove the call. It still works, and warns once in development. `create-grist-widget upgrade` lists each use of these four names by file and line, with what to do.
- 3ffe890: A widget's demo data: export `demo` (a `GristWidgetDemo`, from `grist-widget-sdk`) from `src/app/demo.ts`, and `create-grist-widget demo` and `demo --save` open it in place of sample rows: its tables with typed columns (`Ref:<Table>` included), the rows, which column each declared column maps to (several for `allowMultiple`), and the widget's options. Existing widgets can add `src/app/demo.ts`, then run `pnpm demo --save` to regenerate their demo page.

### Patch Changes

- 3be06b6: A ChoiceList whose first choice is `"E"` (a grade, say) now reads as its choices. Typed reads took the decoded `["E", "M"]` for Grist's encoded formula error, `["E", name, …]`. So `mappedRecord` gave `null` for that cell, and `cellIssues` reported "formula error (M)".
  
  What changes:
  - **`{ encoded: false }`,** which `useGrist()` uses: an array is a list. A formula error is a `RaisedException`, the form Grist decodes one to, or `decodeGristValue`'s `{ __error: true }`, the form `fetchRows(..., { columns })` gives.
  - **The emulator** now decodes a stored `["E", …]` cell into a `RaisedException` in section reads, as Grist does. In a test, a formula error in `w.record` is therefore no longer an array, and `isGristCellError` doesn't match it.
  - **A RefList's display helper** is stored as `["L", ...labels]`, as Grist stores it.
- a791f8b: A column declared with a table or a zone (`"Ref:People"`, `"RefList:Tags"`, `"DateTime:Europe/Paris"`) can be mapped in Grist. Grist offers a column for mapping when its base type (`Ref`, `RefList`, `DateTime`) is declared, so it offered none for such a declaration, and dropped a mapping made before. The SDK now hands Grist each type's base, and keeps the full type for its own reads and checks; `create-grist-widget manifest` lists the columns the same way in `grist-widget.json`, which Grist reads until the widget is ready. The emulator's mappings follow Grist's: every declared column, `null` when unmapped, and a column the table lacks or whose base type the declaration doesn't accept left out. A test that mapped such a column now fails as the widget would in Grist. Existing widgets can map such a test to a column of the table whose type the declaration accepts (an `Any` column takes a value of any type).
- c584d73: The local-dev page (`pnpm dev` outside Grist) points to the widget catalog for patterns to start from, instead of `create-grist-widget list` and `use`, which 0.8 retired.
- 7556810: `grist-widget-sdk` declares `@testing-library/react` (14 or newer) as an optional peer dependency: `grist-widget-sdk/emulator/testing` imports it, which worked only because a widget installs it for its own tests. A widget made from the template already has it; nothing to do. `create-grist-widget`'s package now carries its `CHANGELOG.md`.
- 9938187: Every public name has its TSDoc. The 40 names the API report listed as undocumented, across all entry points, now show a description in an editor's hover, and the docs' reference can be generated from them. No behaviour changes.

## 0.7.0

### Minor Changes

- 5e8e135: `listColumns()` now gives each column's settings as `widgetOptions` (a Choice column's `choices`, a date's format…) and, for a Ref or RefList column, the referenced table's column its cells show as `visibleCol`. A widget can build a typed form from them: a choice list for a Choice column, a picker of the referenced rows for a Ref.
- abe3003: 0.7 removes the names 0.6 deprecated, and the page-wide connection. Before 1.0 a minor can break a widget; from 1.0 a name is deprecated for at least one minor first (the new [versioning policy](https://gristwidgets.com/docs/sdk/api/versioning)).
  
  - `useGrist()` needs `<GristWidgetProvider>`, and throws outside one. Inside Grist, `mountGristWidget()` renders the provider; in a test, pass the declaration, `renderWithGrist(<App />, { widget })`; a component that also runs outside Grist calls `useGristOptional()`, which returns `null` there.
  - `useGrist()` takes no options: declare them with `defineGristWidget()` and call `widget.useGrist()`.
  - `useGristSchema()` takes its schema options only: `requiredAccess`, `columns`, `allowSelectBy`, `hasCustomOptions` and `onEditOptions` go in `defineGristWidget()`. Its `isAvailable` is gone: read `useGrist().status`.
  - `useGristContext()` is gone: call `widget.useGrist()` or `useGrist()`.
  - `useGrist().isReady`, `isAvailable`, `fetchSelectedTable`, `fetchTable` and `fetchTableRows` are gone: `status === "ready"`, `status`, and `fetchRows()` (`{ columnar: true }` for columns).
  - The user-action builders (`gristAddRecordAction`, …) are only in `grist-widget-sdk/actions`.
  
  The types public signatures use are now exported from `grist-widget-sdk`: `GristApi`, `GristCellCheck` (what `checkGristCell` returns), `GristColumnExcludeContext`, `GristDecodedValue`, `GristEncodedError`, `GristEncodedAttachmentList`, `GristMinimalRecord`, `GristReplicaSelection`, `GristTableNewRecord`, `GristTableOpOptions`, `GristTableUpdateRecord`, `GristTableUpsertOptions`, `GristTableUpsertRecord`, `GristWidgetConfiguration` and `GristWidgetLinkingInfo`.
  
  Existing widgets run `pnpm exec create-grist-widget upgrade` after moving to this release: it rewrites the renamed names in `src/` and lists by file and line, test files included, what to change by hand (each `useGrist(options)`, each `useGristSchema()` given connection options, each `renderWithGrist(ui)` without `widget`). `pnpm typecheck` then shows anything left.

### Patch Changes

- 76643e1: The message of an alert above a widget (`mountGristWidget()`'s default alerts) now takes the alert's own colour instead of the muted one. On a warning's amber tint the muted text had a contrast of 4.38:1, under WCAG AA's 4.5:1, which an accessibility check in a real Grist caught on the first catalog widget.
- 5e8e135: `mountGristWidget()`'s default alerts no longer remount the widget when an alert comes or goes. A failed write, or a column mapping being changed, used to reset the widget's state: a half-typed form, an open menu. The widget now keeps its place in the tree, alerts or not.
- 5e8e135: The emulator refuses a write to a column the table doesn't have, with Grist's "Invalid column" error, instead of adding the column. A widget's test now sees the failure the widget would meet in Grist. A table declared with no columns still takes the columns of the rows written to it.
- afc42b1: `patchWidgetOptions()` applies patches one at a time. Two patches made together (a widget saving two settings at once) used to read the same options, and the second overwrote the first; both now land.

## 0.6.2

No changes in this release.

## 0.6.1

### Patch Changes

- 71785f8: **Attachment URLs only take an attachment id.** `getAttachmentUrl()`, `fetchAttachmentBlob()` (and the helpers behind them) now refuse anything but a positive integer as the attachment id, before asking Grist for an access token: the id usually comes from a cell, and the URL built from it carries the document's token, so a crafted value (`"1/../tables"`) could otherwise aim it at another route of the same Grist. The token in the URL is now encoded too.
  
  `grist-widget-sdk` no longer depends on `grain-rpc`, which nothing imported since the iframe transport was removed: one package fewer in every widget.

## 0.6.0

### Minor Changes

- 04fcfe6: **One way to do each thing: `fetchRows()`, `grist-widget-sdk/actions`, and soft deprecations.**
  
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

## 0.5.1

### Patch Changes

- 10015f7: **`mountGristWidget(entry)` and `smokeTestWidget(entry)` read an entry module that also exports its component as `App`.** A widget whose `src/app/App.tsx` has `export function App()` next to `export default App` was taken for the older `{ App, options }` form: `mountGristWidget(entry)` (the 0.5 template's `src/main.tsx`) mounted it without its `GRIST_OPTIONS` (no declared columns, no access level), and `smokeTestWidget(entry)` threw. An entry module is now recognised by its default export.
  
  Existing widgets: nothing to do. A widget on `create-grist-widget` 0.5.0's template with a named `App` export gets its declaration back once this version is installed.

## 0.5.0

### Minor Changes

- d3d9232: **`defineGristWidget()`: one declaration types, mounts and tests a widget.**
  
  ```ts
  export const widget = defineGristWidget({
    title: "Tasks",
    requiredAccess: "full",
    columns: [{ name: "Title", type: "Text" }, { name: "Done", type: "Bool" }],
  })
  const w = widget.useGrist()          // mappedRecord typed from the declaration: no generics, no `as const`
  await w.updateRecord({ Done: true }) // the selected row, encoded for each declared type
  ```
  
  - `defineGristWidget(definition)` keeps the column names and types literal (a `const` type parameter), so `widget.useGrist()` types `mappedRecord`, `mappedRecords`, `mapBack` and the writes from the declaration. `GristWidgetRow<typeof widget>` names the record type.
  - `useGrist()` gains `updateRecord(patch)` / `updateRecord(rowId, patch)` and `addRecord(patch)`: `mapBack` + encoding + `table.update` / `table.create` in one call, under the declared names.
  - `mountGristWidget(entry, { dev })` takes the widget's entry module (`import * as entry from "./app/App"`) and reads its exports: `default`, `widget` (or `GRIST_OPTIONS` and `WIDGET_METADATA`), and optionally `Alerts`, `LocalDevPage`, `ReleasePage`. A widget's customisations then live in its own file instead of `src/main.tsx`. The declaration's title and description set the page's title and meta tags. `mountGristWidget({ App, options, dev })` still works.
  - `renderWithGrist(<App />, { widget, rows })` runs the widget as `mountGristWidget()` does inside Grist, against a table with a column per declared column, every one mapped, seeded with typed rows: no document or mapping setup in a test. `smokeTestWidget(entry)` takes the entry module as `mountGristWidget()` does (or `{ App, widget }`), so one smoke test fits a widget declared either way.
  
  Nothing changes for an existing widget: `GRIST_OPTIONS`, `useGrist<TRow, TMapped>()`, `mapBack` and `table.update` work as before.

### Patch Changes

- 734d307: **`pnpm dev` opens the widget in real Grist, in the browser, with no Docker.** The template ships its demo page (`public/demo/`, a document for its widget and the page that opens it in grist-static), and on the dev server `http://localhost:5173/demo/index.html` runs that Grist on the dev server's own widget: edits reload in place, writes land in the document. The SDK's local-dev page links to it (or says how to get it, `pnpm demo --save`, when the widget has no demo page yet). The scaffold puts the widget's title in the page.
  
  Existing widgets can do nothing: those with a demo page (`pnpm demo --save`) already get it on `pnpm dev` at `/demo/index.html`; the others get it once they run `pnpm demo --save` (Docker, once).
- dfb2e66: **Writes are the mirror of typed reads.** `mapBack` now encodes each value for the type its column declares: a ChoiceList's `string[]`, a RefList's row ids or an Attachments list become `["L", ...]`, a `Date` becomes seconds, a `Reference` its row id. Before, writing back what `mappedRecord` gave stored a ChoiceList or RefList cell as an error (`["E", "KeyError"]`, checked in Grist 1.7.22), because Grist's plugin API writes values as given. `encodeGristCell(type, value)` is exported for writes that don't go through `mapBack`; a value already encoded passes through.
  
  The emulator now stores a bare list written to a list column as Grist does, an error cell reported in `cellIssues`, so `pnpm test` shows the mistake instead of hiding it.
  
  Overlapping writes count as one run: `actionStatus` stays `"running"` until the last one ends, then is `"error"` if any failed (the first write to end used to set it back to `"idle"`). A failed write nobody awaits no longer logs an unhandled rejection; the alert reports it, and the promise still rejects for whoever awaits it.
  
  What to change, if a widget relies on it: a widget that already encoded lists itself (`["L", ...]`, `encodeGristValue`, the attachment helpers) needs nothing. A test that wrote a bare array to a RefList through the emulator now gets an error cell: encode it, or go through `mapBack`.
- ca3f010: `GristMappedRow` now types every declared column as its value or `null`, `Text` and `Bool` included (`Title: string | null`, not `string`). It promised a non-null value for those types while `mappedRecord` holds `null` for a cell that doesn't match its declared type, so a widget trusting the type could crash on a formula error. A widget that reads a `Text` or `Bool` column from a `GristMappedRow` may need a fallback (`row.Title ?? ""`) to compile.
  
  The package README, shown on npm, describes the 0.4.0 surface; it still listed `grist-widget-sdk/advanced`, the slice hooks and the emulator's iframe transport and devtools, all removed in 0.4.0.

## 0.4.0

### Minor Changes

- a257767: The emulator is a test harness only. Removed: `grist-widget-sdk/emulator/transports` (the iframe transport, `createIframeTransport`) and `grist-widget-sdk/emulator/devtools` (the inspector), which only the retired playground used; `createGristEmulator`'s `transport` option takes `{ kind: "inline", target? }` only. `renderWithGrist`, `smokeTestWidget` and `createGristEmulator` are unchanged. To see a widget run, use a real Grist: `pnpm demo`, or its demo page (`pnpm demo --save`).
- 74395a7: **0.4.0: a synchronous runtime and a small public surface (breaking).**
  
  The connection to Grist is one synchronous `connect()` and one store read through `useSyncExternalStore`, instead of the handshake state machine (detection polling, a 30 s heartbeat, generations). `useGrist()` keeps its shape for what widgets use and re-renders less (a cursor move: 3 renders to 1). The root entry exports 29 runtime names instead of about 195; `grist-widget-sdk/advanced` is gone.
  
  Fixed on the way: `fetchSelectedTable()` returned rows while typed as columns (a widget passing it to `tableDataToRows()` got nothing; it now returns columns); `mode` stuck on `"new-row"` when the selection went away; records reused and mutated by the host no longer go unnoticed. The emulator now matches Grist on `setOptions` (replaces), the add-row (`onNewRecord` only), unmapped columns (`mappedRecord` is `null`) and access (it grants what the widget asks for unless a test sets `widgetInteraction.access_level`).
  
  What to replace, if a widget uses it (the six reference widgets need nothing):
  
  | Removed | Use instead |
  | --- | --- |
  | `useGristSelection()`, `useGristStatus()`, `useGristWrites()`, `useGristTheme()` | `useGrist()` |
  | `grist-widget-sdk/advanced` (`useGristReady`, `useGristHandshake`, `useGristCapabilities`, `useGristRowsFromTable`, …), `GristHandshakeProvider` | `useGrist()` (`status`, `columnMappingStatus`), or `fetchTableRows` in an effect |
  | `w.capabilities` | `w.status`, `w.columnMappingStatus.ok`, `w.isReady` |
  | `w.getWidgetOptions()`, `w.getWidgetOption(key)` | `w.widgetOptions` |
  | `w.setWidgetOption(key, value)` | `w.patchWidgetOptions({ [key]: value })` |
  | `w.clearWidgetOptions()` | `w.setWidgetOptions({})` |
  | `w.fetchRow(table, id)` | `w.fetchTableRows(table)` |
  | `w.fetchSelectedRecord(id)` | `w.record`, or `w.fetchSelectedTable()` |
  | `w.buildReplicaDocumentFromDocApi(...)`, `buildReplicaDocumentFromDocApi` | `useGristSchema()` |
  | `w.getDocName()`, `w.configure()`, `w.refreshMappings()`, `w.refreshCurrentTable()`, `w.currentTableLoading` | — (`currentTableId` and `mappings` follow Grist) |
  | `w.isNewRecord`, `w.recordsMappings`, `w.newRecordMappings` | `w.mode === "new-row"`, `w.mappings` |
  | `w.widgetInteraction`, `w.readError`, `w.mapBackSkipped` | the alerts `mountGristWidget()` shows |
  | `w.getAccessToken()`, `w.fetchAttachmentBase64()`, `getGristAccessToken`, `fetchWithGristAuth` | `w.fetchWithAuth()`, `w.fetchAttachmentBlob()` |
  | `<GristBoundary gate widget bootingFallback …>` | `<GristBoundary>`: it gates on declared columns itself |
  | alert and boundary helpers (`getGristSdkAlertDescriptors`, `deriveBoundaryView`, `format…AlertMessage`, …), `validateColumnMappings` | `mountGristWidget()` shows them; `w.columnMappingStatus` |
  | replica builders and normalizers, value codecs beyond `decodeGristValue` / `encodeGristValue` / `isGristCellError`, `gristBulk*` / table / document action builders | write the user-action tuple; `useGristSchema()` |
  | `GristReadyOptions.availabilityMaxAttempts`, `availabilityIntervalMs`, `logWhenNotEmbedded` | — (no polling) |
- 673a02d: **Typed reads, with read-only access; no zod in a widget's bundle.**
  
  Each mapped cell is now checked against the type its column declares in `GRIST_OPTIONS.columns`: no schema to fetch, no full access. `mappedRecord` (and the new `mappedRecords`, every row of the section) holds the value each type promises (`Text` → string, `Numeric` → number, `Date` → `Date`, `Ref` → row id, `RefList` / `Attachments` → ids, `ChoiceList` → strings); a cell that doesn't match (text Grist couldn't parse, a formula error, a column whose type changed) is `null`, and listed in the new `cellIssues` (`{ rowId, column, message, value }`), which `mountGristWidget()` shows as a `cell-issues` alert. `GristMappedRow<typeof GRIST_OPTIONS>` types the mapped records from the declaration (declare it `as const satisfies UseGristOptions`). `UseGristOptions.schema` takes any Standard Schema (zod 4, valibot, arktype) for extra rules; the SDK depends on none. `checkGristCell(type, value)` checks a value read another way.
  
  Removed: `safeParseGristTableData`, `safeParseRowsToDisplayRows` and `fetchTableRows`'s `safeParse` option (the zod-based safe-parse), which put zod in every widget. A widget's template build goes from 129 KB to 94 KB of JavaScript, gzipped; CI now fails above 100 KB.
  
  What to change, if a widget relies on it (the six reference widgets need nothing): a `Ref` column's value in `mappedRecord` is now its row id (it was a `Reference` object), and a cell that doesn't match its declared type is `null` (it was the raw value); safe-parse users read `mappedRecords` / `cellIssues`, or call `checkGristCell` per cell.

### Patch Changes

- f4a467a: Routine dependency updates via Dependabot (PR #241). See the PR diff for the exact version bumps.
- f5e04b4: `fetchWithGristAuth()` (and `w.fetchWithAuth()`) now refuses an absolute URL on another origin than the document's Grist instance, instead of sending the document's access token there. The token travels as the `auth` query parameter, so a URL taken from a cell or another input could hand it to any host. Relative paths and absolute URLs on the Grist instance work as before; for other hosts, use plain `fetch()`.

## 0.3.27

### Patch Changes

- c5ea5c8: New in `grist-widget-sdk/emulator/testing`: `smokeTestWidget({ App, options })`, a widget's whole smoke test in one call. It mounts the widget the way `mountGristWidget()` does inside Grist, against an emulated document with one table holding a column per declared column and a row of sample values. Every column is mapped and the requested access granted, and the test waits until the widget renders past `GristBoundary`. It rejects with the widget's own error if it throws, or with what the page showed instead if it never gets there, and accepts a `document` and a `timeout`. It only reads `GRIST_OPTIONS`, so the test stays valid as the widget changes.
  
  Also new: `installJsdomStubs()`, inert `ResizeObserver` and `matchMedia` stand-ins for whichever jsdom lacks, for a widget's other tests or a Vitest setup file. `smokeTestWidget()` installs them itself.

## 0.3.26

### Patch Changes

- acc1501: New entry point, `grist-widget-sdk/app`: `mountGristWidget({ App, options, dev })` does what a widget's `src/main.tsx` used to wire by hand.
  
  - **Inside Grist** it renders the widget in `GristWidgetProvider` and `GristBoundary`, gated on mapped columns when the widget declares any, with the SDK's alerts above it (column mapping, access level, failed writes, an unlinked section). `App` may be a `React.lazy()` component, so a heavy widget's code loads only inside Grist.
  - **Outside Grist** it shows a local-dev page on the dev server, pointing at `pnpm test` and the `dev` loop, and a release page on a deployed URL, linking every channel and version with the URL to paste into Grist. Both are named after the page's `<title>`.
  - **The theme**: inside Grist the widget now follows Grist's light/dark theme (the OS setting until Grist sends it); outside Grist the OS setting applies, a choice made with `setTheme()` is saved, and the `d` key switches themes, as shadcn's theme provider does. `useTheme()` has the shape of shadcn's, for components such as a toaster.
  
  The pages and alerts read shadcn's CSS variables (`--background`, `--foreground`, `--border`, `--radius`, …) with neutral fallbacks, so they follow a widget's theme without depending on its Tailwind config, and each one is replaceable (`Alerts`, or `Alerts: null`; `LocalDevPage`; `ReleasePage`). They only surround the widget: the SDK still styles nothing inside it. `<GristWidgetApp>` is the same tree as a component, for tests, and `parseDeployPath()`, `deployChannelLabel()` and `useReleasedVersions()` serve a custom release page.

## 0.3.25

### Patch Changes

- bbcca4d: New: shared TypeScript settings for widgets, to `extends` from a widget's own tsconfig files. `grist-widget-sdk/tsconfig/app.json` covers the browser code in `src/` (bundler resolution, `react-jsx`, `strict` and the unused-code checks); `grist-widget-sdk/tsconfig/node.json` covers `vite.config.ts`. Both are the settings scaffolded widgets have used so far, so a compiler-setting change can now reach widgets with an SDK update instead of a hand edit in each one. They need TypeScript 5.8 or later. A change that makes a check stricter can fail a widget's typecheck, so it only ships in a minor release.

## 0.3.20

### Patch Changes

- 87d98f0: Fix declaration emit for code that wraps SDK hooks. A library compiled with `declaration: true` that re-exported `useGristStatus()` or `useGristHandshake().status` with an inferred type failed with TS2883 (TS2742 before TypeScript 6), "cannot be named without a reference to '…/dist/use-grist-widget-options-from-context-…'", because those signatures reached types that only a private build chunk exported.
  
  The types involved are now public: `UseGristStatusResult`, `UseGristSelectionResult`, `UseGristWritesResult` and `UseGristThemeResult` (the slice-hook return types the docs already named, now exported and used as the hooks' declared return types), plus `UseGristCoreOptions` and `UseGristCoreResult`, the connection types they build on. `GristWidgetStatus` is now a single type shared by `grist-widget-sdk` and `grist-widget-sdk/advanced`, where there used to be two identical ones. All additions are type-only. At runtime, `docApi` is now read from `window.grist` on every render instead of memoized on the handshake phase, so it can no longer outlive a `window.grist` that was replaced or removed (as the emulator does) while the phase stayed `online`; in real Grist the global never changes, so the value is the same.

## 0.3.17

### Patch Changes

- f7d9e54: Routine dependency updates via Dependabot (PR #172). See the PR diff for the exact version bumps.

## 0.3.16

### Patch Changes

- 91c1ca6: Refresh dependencies: `zod` 4.6 at runtime; dev tooling moves to vite 8, @vitejs/plugin-react 6, eslint 10, jsdom 30 and @testing-library/jest-dom 7. The "attachment upload was blocked by the Grist host (CORS)" error now carries the original fetch failure as `error.cause`.

## 0.3.15

### Patch Changes

- 80b2ed1: Routine dependency updates via Dependabot (PR #141). See the PR diff for the exact version bumps.

## 0.3.14

### Patch Changes

- ed810fd: Wired up lint (`eslint.config.js` + CI gate) and coverage reporting (`test:coverage`). Turning lint on for the first time surfaced and fixed a few real issues: a dead `try`/`catch` in the RPC-heartbeat-coalesce helper that just rethrew without doing anything (removed, matching the module's own documented "failures aren't coalesced" contract), and a handful of dead imports. No public API changes.

## 0.3.3

### Patch Changes

- bb1f20a: Point package metadata and documentation links at the live docs site.

  Both packages' `homepage` fields pointed at `grist-widgets.com`, a domain with
  no DNS record, so the Homepage link on both npm pages was dead. They now point
  at `https://gristwidgets.com`.

  The README links that resolved into `apps/docs/` — a directory that has been
  removed from the repo — now point at the equivalent pages on the docs site, so
  they keep working for anyone reading the package on npm. The same fix applies
  to the template README that ships inside every scaffolded widget.

  No runtime behavior changes.

## 0.3.0

### Minor Changes

- f2604a3: `EmulatorInspector` (the drop-in devtools component) gains an "Access level" control: three buttons (none / read table / full) that call `emulator.setInteraction({ access_level })` at runtime, so you can test how a widget behaves under each granted level without editing code and reloading. The emulator already supported this (`setInteraction` + transports reading `state.widgetInteraction`), it just had no UI to drive it.

## 0.2.15

### Patch Changes

- 3e98894: Fix a race that could silently override a widget's real declared `requiredAccess`/`columns` on Grist's side — Grist's Creator Panel would never show the Column Mapping section, and would offer only "read" access instead of "full", even though the widget's own code correctly declared them (its local on-page alerts still showed the correct values, since those only echo local config).

  Root cause: both `<GristHandshakeProvider>` (mounted internally by `<GristStatusChip>` with no options) and standalone `useGristHandshake()` built their manager directly via `createGristHandshakeManager()`, bypassing the page-level `ensureGristReady()` singleton that `<GristWidgetProvider>` uses. That let either one call the real `grist.ready()` **directly**, with a bare default `{requiredAccess: "read table", columns: []}` payload — and since Grist only honors a widget's first `ready()` call, that default could win the race against the real widget's manager.

  Three changes:
  - `<GristHandshakeProvider>` and `useGristHandshake()` now default `negotiate.readyImpl` to `ensureGristReady()` (callers can still override), so they can no longer bypass the dedupe.
  - `ensureGristReady()`'s reinit check now also compares declared columns, not just access-level rank — previously a widget that kept the default `"read table"` access but declared real `columns` would still lose them if a bare fallback call (same access rank) won the race first.
  - New `useAmbientGristHandshake()` (`grist-widget-sdk/advanced`) observes whatever handshake manager a `<GristWidgetProvider>` ancestor already published, without ever creating a new one. `<GristStatusChip>` (the template's own component) now uses this instead of mounting its own `<GristHandshakeProvider>`, and must be nested inside `<GristWidgetProvider>` — eliminating the race for that case structurally rather than just deduping it.

## 0.2.1

### Patch Changes

- 3c0315f: Relicense to MIT and ship the `LICENSE` in the published tarball. No runtime or
  API changes — `dist` is identical to 0.2.0; this release corrects the package
  license metadata (0.2.0 shipped as ISC) and lands the release tooling (OIDC
  Trusted Publishing + external-install smoke test).

This file is generated by [Changesets](https://github.com/changesets/changesets)
and is the canonical changelog for the published `grist-widget-sdk` npm
package, starting at `0.2.1`. Every entry corresponds to a version actually
published to npm.

For the fuller project history — widgets, docs, tooling, process — see the
monorepo root [`/CHANGELOG.md`](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/CHANGELOG.md).

## 0.2.0

Published manually (pre-Changesets); see the root changelog's **0.1.0** →
**Unreleased — 0.2.0** history for everything that shipped in this version.
