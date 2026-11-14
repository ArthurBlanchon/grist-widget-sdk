# grist-widget-sdk

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
