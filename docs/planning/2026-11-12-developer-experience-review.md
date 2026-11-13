---
title: Developer experience review — 2026-11-12
---

# Developer experience review — 2026-11-12

> **Status: in progress.** SDK and CLI 0.5.0 shipped (#245–#248); the 0.6.0
> surface is in the SDK (fetchRows, `grist-widget-sdk/actions`, the
> deprecations); `upgrade`'s codemods and 1.0 are left (see `TODO.md` §1).
> The page-wide connection (`useGrist()` outside a provider) stays in 0.6:
> `renderWithGrist(<App />)` without `widget` and the six widgets' tests use
> it; 1.0 decides whether `renderWithGrist` always renders a provider.
>
> Scope: the SDK's public surface, the template a
> widget starts from, and how a widget takes in later versions, judged by
> one question: *how simple is it for a professional engineer to build,
> test and maintain a widget?* Read after SDK 0.4.0 and the six reference
> widgets' 0.2.0 release. Evidence is from the code, from what the six
> widgets actually call, and from probes in a real Grist (1.7.22); each
> finding says which.

## 1. Verdict

**The foundations are right, and several of them are already the best
available for Grist.** One hook, a synchronous store, a boundary that hides
connection states, typed reads with read-only access, tests without a
browser, a smoke test that guards every SDK update, real Grist locally
(`pnpm demo`) and on a static page (`/demo/`), a deploy pipeline with
channels, `upgrade` for template files, Dependabot, and CI that runs the
real widgets on every SDK change. Keep all of it.

**What stands between it and a state-of-the-art developer experience is
mostly in five places:**

1. **Writes are not the mirror of reads**, and the gap corrupts data: a
   `ChoiceList` or `RefList` value read through `mappedRecord`, written back
   through `mapBack` + `table.update`, becomes an error cell in Grist. The
   emulator hides it. (§3.1)
2. **Typing takes ceremony** the SDK could do itself: two generics, a
   hand-written row shape, `as const satisfies`, `!` assertions, casts. The
   template doesn't use the typed reads 0.4.0 shipped. (§3.2)
3. **The template is not the reference implementation it should be:** 185
   lines with a debug panel, a column-mapping check the boundary already
   does, and tests that map columns by hand. (§3.4)
4. **A widget's own wiring has no upgrade-safe home,** and `upgrade`
   overwrites silently. (§3.5)
5. **Evolution has no contract yet:** 0.x, a release that removed ~165 names
   in one step, no deprecation period, no codemods, two packages with two
   update flows. (§3.7)

None of these needs a rewrite. Three releases fix them (§5).

## 2. What is already at the bar (keep)

| Area | What works | Evidence |
| --- | --- | --- |
| Entry point | `src/main.tsx` is one `mountGristWidget()` call; provider, boundary, alerts and theme live in the SDK | template, six widgets |
| Runtime | One synchronous `connect()`, `useSyncExternalStore`, stable methods | 0.4.0; bench: a cursor move renders once |
| Typed reads | Each mapped cell checked against its declared type, `cellIssues`, read-only access | probe in Grist 1.7.22 (#239) |
| Failure UX | `GristBoundary` screens (connecting, outside Grist, access, mapping) and alerts above a running widget | contract tests |
| Tests | `renderWithGrist`, `smokeTestWidget` in every widget's CI, so an SDK release that breaks a widget turns its Dependabot PR red | six widgets |
| Real Grist | `pnpm demo` (Docker, HMR), `pnpm demo --save` and `<channel>/demo/` (grist-static) | six demo pages |
| Delivery | Channels `/dev/`, `/latest/`, `/v<x>/`, manifest, registry | 0.2.0 release |
| Safety nets | Real-widgets CI, `gate`, size budget (94 KB gzip), render bench, pnpm 24 h age check, origin check on the access token | CI |
| Agents | `AGENTS.md` per repo, `llms.txt`, ESLint rule against the `grist` global | |

## 3. Findings

Each finding: what a developer meets, the evidence, and the change.
**P0** corrupts data or misleads, **P1** costs every widget, **P2** costs some.

### 3.1 Writes are not the mirror of reads (P0)

**What a developer meets.** The documented write idiom is
`w.table.update({ id: w.record!.id, fields: w.mapBack(patch) })`. With
typed reads, `patch` naturally holds what `mappedRecord` gave: `string[]`
for a ChoiceList, row ids for a RefList, a `Date`.

**Evidence (real Grist 1.7.22, `UpdateRecord` with the values as
`TableOperations.update` sends them; the plugin API does not encode values,
it only passes `parseStrings`):**

| Column | Written | Stored |
| --- | --- | --- |
| `ChoiceList` | `["a", "b"]` | an error cell, `["E", "KeyError"]` |
| `RefList:P` | `[1, 2]` | an error cell, `["E", "KeyError"]` |
| `Date` | ISO string (a `Date` crosses as its JSON) | `1794441600`, correct |
| `DateTime:UTC` | ISO string | correct |

The emulator turns a bare array into `["L", …]` for RefList
(`action-engine.ts`), so a widget's tests pass while real Grist corrupts the
cell. The writing guide says the write path "handles this for common cases";
it doesn't.

**Change.**
- `mapBack` (and the typed writes of §3.2) encode each value by its declared
  type: lists to `["L", …]`, `Date` to seconds; values already encoded pass
  through. The SDK has the declared types; the developer shouldn't need
  `encodeGristValue`.
- The emulator stores what Grist would: a bare array written to a list
  column becomes the same error cell, so the bug shows in `pnpm test`.
- A contract test writes every declared type and reads it back, against the
  emulator in CI and against real Grist in the weekly run.

### 3.2 Typing: one declaration, no generics (P1)

**What a developer meets.**
- `useGrist<TRow, TMapped>()`: two type parameters. Five of the six widgets
  write the mapped shape by hand (`EventMapped`, `DraftMappedRecord`, …);
  `TRow` is rarely needed.
- `GristMappedRow<typeof GRIST_OPTIONS>` works only with
  `as const satisfies UseGristOptions`; the template declares
  `GRIST_OPTIONS: UseGristOptions`, which widens the names and types and
  defeats it.
- `mapBack(patch)` returns `Record<string, unknown>`; scan-with-ai casts
  (`as Parameters<typeof w.mapBack>[0]`), every writer uses `w.record!.id`.
- Options passed to `useGrist(options)` are silently ignored inside the
  provider (always the case under `mountGristWidget`).

**Change: `defineGristWidget()`.**

```ts
// src/app/widget.ts
export const widget = defineGristWidget({
  title: "Tasks",
  requiredAccess: "full",
  columns: [{ name: "Title", type: "Text" }, { name: "Done", type: "Bool" }],
})

// any component
const w = widget.useGrist()          // w.mappedRecord: { id; Title: string | null; Done: boolean | null } | null
await w.updateRecord({ Done: true }) // the selected row, declared names, encoded per type
await w.addRecord({ Title: "New" })
```

- A `const` type parameter infers the literal types: no `as const`, no
  generics, no hand-written shapes. Metadata joins the declaration
  (`WIDGET_METADATA` and the `useWidgetMetadata()` call each widget makes
  go away: `mountGristWidget` sets the title).
- `updateRecord(patch)` / `updateRecord(id, patch)` / `addRecord(patch)`
  replace the three-step idiom: `mapBack` + encode (§3.1) + the selected
  row's id, typed `Partial<Row>`.
- `main.tsx` becomes `mountGristWidget(widget, App)`; `GRIST_OPTIONS` stays
  accepted for existing widgets.

### 3.3 One way to do each thing (P1)

| Today | Proposal | Why |
| --- | --- | --- |
| `useGrist`, `useGristContext`, `useGristOptional`; a page-wide connection outside a provider, made with the first caller's options | `widget.useGrist()`; `useGristOptional()` for components that also run outside Grist | the three differ only in what they do without a provider; the page connection exists for a case `mountGristWidget` no longer has |
| `status`, `isReady`, `isAvailable` (`boolean \| null`), `error` | `status` and `error` | four flags for one state machine |
| `fetchTable` (columns), `fetchTableRows` (rows), `fetchSelectedTable` (columns) | `fetchRows(tableId?)`, rows by default, `{ columnar: true }` when wanted | the widgets convert columns to rows each time |
| `record`/`records` (raw ids) next to `mappedRecord`/`mappedRecords`; 7 `resolveMappedColumnId` calls in the widgets | mapped first; raw records for widgets without declared columns | `mappedRecords` (0.4.0) supersedes reading raw rows by resolved ids |
| 9 user-action builders in the root entry | `grist-widget-sdk/actions` | schema changes are rare; the root entry stays what every widget needs |

The widgets check `w.columnMappingStatus` 24 times although
`GristBoundary` already holds the widget until required columns are mapped:
the template teaches it (§3.4). Optional columns are the only case left, and
`mappedRecord` already says it (`undefined`).

### 3.4 The template as the reference implementation (P1)

**What a developer meets** in `src/app/App.tsx` (185 lines): a
"Grist selection debug" panel, a manual column-mapping branch the boundary
makes dead, hand-written types in `grist-types.example.ts`,
`GRIST_OPTIONS: UseGristOptions` (§3.2), and `App.test.tsx` that has to call
`emulator.setColumnMappings({ title: "title", done: "done" })` itself, while
`smokeTestWidget` maps declared columns automatically.

**Change.**
- The template shows the target way and nothing else: `widget.ts`
  (declaration), `App.tsx` of about 40 lines (typed read, typed write, the
  three `mode`s), one behaviour test, the smoke test.
- `renderWithGrist(<App />, { widget, rows })` maps the declared columns and
  seeds a table from typed rows, like `smokeTestWidget`; a test reads as the
  widget's behaviour, not as emulator setup.
- The debug panel leaves the template (a snippet in the docs, if wanted).

### 3.5 The entry point and `upgrade` (P1)

**What a developer meets.**
- The docs offer `Alerts`, `LocalDevPage` and `ReleasePage` as
  `mountGristWidget()` options. The only place to pass them is
  `src/main.tsx`, a template file `upgrade` overwrites, so the customisation
  is lost at the next upgrade.
- `upgrade` writes every template file whose content differs. It doesn't
  notice a hand-edited `main.tsx`, or a widget file at a path a newer
  template starts using (`src/lib/…`, `src/components/…`: five of the six
  widgets keep code there).

**Change.**
- Customisations are part of the declaration (`defineGristWidget({ …,
  Alerts, ReleasePage })`) or exports of `App.tsx`; `main.tsx` passes them
  on and stays identical in every widget.
- `upgrade` keeps the fingerprints of every `main.tsx` the template has
  shipped and refuses one it doesn't know, saying what to move into
  `src/app/`; it refuses to write a template file over a widget file that a
  previous template didn't write.

### 3.6 The inner loop with real Grist (P1)

**Today:** `pnpm test` (emulator, seconds), `pnpm demo` (real Grist, needs
Docker), or a push to `dev` (minutes, through GitHub Pages). `pnpm dev`
outside Grist shows a page by design: no fake preview.

**Change: `pnpm dev` opens the widget in real Grist without Docker.**
grist-static is Grist itself running in the browser, already proven by the
demo pages. The dev server serves a page that opens the widget's demo
document (or one generated from the declaration) with the widget URL patched
to the Vite server, so edits reload in place inside real Grist. It keeps the
"no fake preview" rule: nothing is emulated. Docker `pnpm demo` stays for
what grist-static lacks (to establish: attachments over REST,
`fetchWithAuth`, multi-user access rules).

### 3.7 Evolution: a contract for upgrades (P2, P1 before 1.0)

**What a maintainer meets.**
- 0.x: any minor may break. 0.4.0 removed about 165 names at once; the
  changelog's "what to replace" table is good, but there was no release in
  which the old names warned first.
- Two packages, two update flows: Dependabot bumps `grist-widget-sdk`
  (code), and separately `create-grist-widget` (template), after which
  someone runs `upgrade` by hand on `dev`.
- The public names are pinned (`public-api.test.ts`), not their types: the
  `GristMappedRow` change in #242 would not show in a review as an API
  change.
- The React range the SDK supports is declared (`>= 18`) but tested on 19
  only (TODO §2).
- A widget's release is a manual version bump; its `CHANGELOG.md` is never
  written.

**Change.**
- **1.0 with a written policy:** a name to remove is deprecated first
  (`@deprecated`, plus one development-only console warning) for at least
  one minor, and goes in the next major; every breaking change ships a
  codemod that `upgrade` runs.
- **One update flow:** Dependabot groups the two packages; a widget CI job
  on that PR runs `upgrade` and commits the template changes, so merging the
  green PR is the whole upgrade.
- **API report:** an extracted `.d.ts` report checked in CI, so type changes
  are reviewed as API changes.
- **React 18 and 19** in the core job's matrix.
- **Widget releases:** a `pnpm release <patch|minor|major>` that bumps,
  writes the changelog entry from the merged PRs and opens the `dev` →
  `main` PR.

### 3.8 Smaller findings (P2)

- **Concurrent writes:** `actionStatus` goes back to `idle` when the first
  of two overlapping writes ends, while the second still runs (no counter in
  `api.ts`'s `write`).
- **Fire-and-forget writes:** a failed write is both shown in the alerts
  and thrown; an `onClick={() => w.table.update(…)}` without `catch` also
  logs an unhandled rejection. The promise the SDK returns could carry a
  no-op handler (still rejecting for whoever awaits it), so the alert is
  enough.
- **`useGristSchema(options)`** inside a provider ignores its own
  `requiredAccess` (gantt passes `"read table"` under a full-access widget):
  harmless, but it reads as if it did something.
- **Per-widget `AGENTS.md`** is 170 lines; a human's first five minutes need
  a 20-line "first widget" path (declare, map, read, write, test, push).

## 4. What a widget looks like after

```ts
// src/app/widget.ts
import { defineGristWidget } from "grist-widget-sdk"

export const widget = defineGristWidget({
  title: "Tasks",
  description: "Mark the selected task done.",
  requiredAccess: "full",
  columns: [{ name: "Title", type: "Text" }, { name: "Done", type: "Bool" }],
})
```

```tsx
// src/app/App.tsx
import { widget } from "./widget"

export default function App() {
  const w = widget.useGrist()
  if (w.mode !== "row") return <p>Select a task.</p>
  return (
    <label>
      <input type="checkbox" checked={!!w.mappedRecord.Done} onChange={(e) => w.updateRecord({ Done: e.target.checked })} />
      {w.mappedRecord.Title}
    </label>
  )
}
```

```tsx
// src/app/App.test.tsx
it("marks the task done", async () => {
  const { emulator } = renderWithGrist(<App />, { widget, rows: [{ Title: "Ship", Done: false }] })
  fireEvent.click(await screen.findByRole("checkbox"))
  await waitFor(() => expect(emulator.rows("Done")).toEqual([true]))
})
```

`src/main.tsx` stays `mountGristWidget(widget, App)` in every widget.

## 5. Plan

Each step keeps the six reference widgets green (Real widgets workflow,
`e2e:grist`) and ships its changeset; breaking ones say what to change.

| Release | Content | Done when |
| --- | --- | --- |
| **SDK 0.5.0** (correctness, typing) | Encoded writes in `mapBack`; emulator parity for list writes; write round-trip contract test (emulator and real Grist); `actionStatus` counter; `defineGristWidget`, `updateRecord`/`addRecord`; `renderWithGrist({ widget, rows })` | A ChoiceList/RefList/Date round trip passes in real Grist; the template compiles with no generics or casts |
| **CLI 0.5.0** (template, upgrade, loop) | Template rewritten on §4; customisations in the declaration; `upgrade` refuses unknown `main.tsx` and path collisions; `pnpm dev` on grist-static | A scaffold to first green test and first real-Grist view, without Docker, in under five minutes |
| **0.6.0** (surface) | One hook, `status` + `error`, `fetchRows`, actions subpath; old names deprecated with warnings | The six widgets migrated by `upgrade`'s codemods |
| **1.0** | Deprecated names removed; versioning policy and API report in CI; React 18/19 matrix; grouped Dependabot with automatic `upgrade`; `pnpm release` for widgets | The policy is in the docs and CI enforces the API report |
