# grist-widget-sdk

React hooks for [Grist](https://www.getgrist.com) custom widgets: one
`useGrist()` for the connection, the selected record and the section's
records, column mapping, typed reads, writes, widget options and the
document's REST API, plus an emulator to test a widget without Grist.

Documentation: <https://gristwidgets.com/docs>. To start a widget, use the
scaffold, which wires all of this up:

```bash
npm create grist-widget my-widget
```

## Why not `grist` directly?

| Raw `grist` | SDK |
| --- | --- |
| `grist.ready` and `onRecord` callbacks | `useGrist()`: `status`, `record`, `records`, `mode` |
| Wire-format dates, refs and errors | Each mapped cell as its declared type (`mappedRecord`), mismatches in `cellIssues` |
| `mapColumnNames`, tuples for writes | `mappedRecord`, `mapBack`, `table.update` |
| No test harness | `renderWithGrist` with emulator presets |

Full comparison: [Raw plugin API vs SDK](https://gristwidgets.com/docs/sdk/guide/raw-plugin-api-vs-sdk).

## Install

```bash
pnpm add grist-widget-sdk
```

Peer dependencies: `react` and `react-dom` 18 or later. The page must load
Grist's plugin API, which defines the `grist` global:

```html
<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
```

## A widget

```tsx
// src/app/App.tsx
import { defineGristWidget } from "grist-widget-sdk"

export const widget = defineGristWidget({
  title: "Tasks",
  requiredAccess: "full",
  columns: [{ name: "Title", type: "Text" }, { name: "Done", type: "Bool" }],
})

export default function App() {
  const w = widget.useGrist() // w.mappedRecord: { id; Title: string | null; Done: boolean | null } | null
  if (w.mode !== "row" || !w.mappedRecord) return <p>Select a task.</p>
  return <button onClick={() => w.updateRecord({ Done: true })}>{w.mappedRecord.Title}</button>
}
```

```tsx
// src/main.tsx
import { mountGristWidget } from "grist-widget-sdk/app"
import * as entry from "./app/App"

mountGristWidget(entry, { dev: import.meta.env.DEV })
```

The declaration types everything with no generics: the mapped records, and
the writes (`updateRecord`, `addRecord`), which encode each value for its
declared type. `mountGristWidget()` reads `App.tsx`'s exports: the widget,
its declaration (for the access, the columns and the page title), and any
page it replaces. Inside Grist it renders the widget in `GristWidgetProvider`
and `GristBoundary` (the connecting, access and column-mapping screens), with
the SDK's alerts, in Grist's light or dark theme.

## Entry points

- **`grist-widget-sdk`**: `defineGristWidget`, `useGrist`, `useGristOptional`,
  `GristWidgetProvider`, `GristBoundary`, `useGristSchema`,
  `useWidgetMetadata`, `checkGristCell`, `encodeGristCell`, the value codec, the attachment
  helpers, and Grist's types.
  [API reference](https://gristwidgets.com/docs/sdk/api).
- **`grist-widget-sdk/actions`**: the user-action builders for `applyActions`.
- **`grist-widget-sdk/app`**: `mountGristWidget`, `GristWidgetApp`,
  `useTheme`, and the deploy-channel helpers the scaffold's pages use.
  [Reference](https://gristwidgets.com/docs/sdk/api/app).
- **`grist-widget-sdk/emulator`**: `createGristEmulator`, document
  `presets`, `parseDocument`. [Reference](https://gristwidgets.com/docs/emulator/api).
- **`grist-widget-sdk/emulator/testing`**: `renderWithGrist`,
  `smokeTestWidget`, `installJsdomStubs`, the matchers (`actionsOf`,
  `eventsOf`, `waitForEvent`), `presets`, and the usual
  `@testing-library/react` helpers. [Testing](https://gristwidgets.com/docs/emulator/testing).
- **`grist-widget-sdk/tsconfig/app.json`**, **`/tsconfig/node.json`**: the
  compiler settings a scaffolded widget extends.

ESM and CJS builds, with type declarations.

## Testing a widget

```tsx
import { fireEvent, renderWithGrist, screen, waitFor } from "grist-widget-sdk/emulator/testing"
import App, { widget } from "./App"

it("marks the task done", async () => {
  const { emulator } = renderWithGrist(<App />, { widget, rows: [{ Title: "Ship", Done: false }] })
  fireEvent.click(await screen.findByRole("button", { name: "Ship" }))
  await waitFor(() => expect(emulator.state.tables.get("Table1")!.rows[0]).toMatchObject({ Done: true }))
})
```

The emulator runs in the test process and stands in for `window.grist`. It
is a test harness, not a preview: to see a widget run, use a real Grist
(`pnpm demo` in a scaffolded widget, or its demo page).

## Developing this package

From the monorepo root:

```bash
pnpm --filter grist-widget-sdk build
pnpm --filter grist-widget-sdk test
pnpm --filter grist-widget-sdk exec tsc --noEmit
```
