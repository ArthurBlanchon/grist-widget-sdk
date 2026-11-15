# SDK open questions (retired 2026-11-14)

> Kept for the record: the docs site's "Open questions" page, as it stood
> when the maintainer docs moved into the repository. Most of it predates
> `defineGristWidget()` (0.5) and the removals of 0.7, and is settled or
> obsolete. A question still worth asking becomes a decision record in
> `docs/decisions/`.

Things we should decide before locking the 1.0 surface. Each entry is small enough to debate in a single discussion thread.

> Resolved questions move into the relevant `/guide/` or `/api/` page in
> the same iteration; see [Contributing](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/CONTRIBUTING.md) for the process.

> Marker legend: 🅐 = API surface • 🅑 = Behavior • 🅒 = Types • 🅓 = Docs only

## Naming

### 🅐 `useGrist` vs `useGristWidget`

`useGrist()` is short, but the package is `grist-widget-sdk`. Are we losing clarity by dropping "widget"? Alternative: `useGristWidget()` as canonical, `useGrist` as alias.

**Vote:** keep `useGrist` for brevity, document the rationale.

### 🅐 `mappedRecord` vs `record.mapped`

Today `mappedRecord` lives flat on the return object. Some users expect `record.mapped`. Trade-off: discoverability vs flatness.

**Vote:** keep flat — drilling down to `record.raw` / `record.mapped` reads worse.

## Behavior

### 🅑 `mapBack` and `allowMultiple` columns

Reverse-mapping is ambiguous when multiple real columns share one logical name. Current behavior: skip with a console warning.

Options:

1. **Skip silently** — minimal surprise, possibly silent data loss.
2. **Throw** — forces the user to pick. Breaking change.
3. **Skip + surface in `actionError` / alerts** — recommended.

**Vote:** option 3.

### 🅑 `widgetOptions` debounce

`patchWidgetOptions(...)` is sync today, no debounce. The advanced `useGristWidgetOptions` debounces. Should the primary surface also debounce?

Options:

1. **No debounce in primary** — predictable, consistent with other writes.
2. **Configurable debounce on provider** — adds knobs.

**Vote:** option 1. If you need debounce, use `useGristWidgetOptions`.

### 🅑 `actionStatus` reset

When does `actionStatus` go back to `"idle"` after `"error"`? Options:

1. **Sticky until next action** — current.
2. **Auto-reset on next emit** — bad, user can't render the error.
3. **`clearActionError()` method on `useGrist`** — adds surface.

**Vote:** option 1, document the staleness.

### 🅑 `unavailableGraceMs`

Default 5000 ms. Some environments (slow corporate VPN, embedded iframes) reportedly need >10s. Should we expose this as a global env / provider option?

**Vote:** it's already on `<GristBoundary>` — fine. Document the failure mode.

### 🅑 Token cache scope

Today the REST token cache is module-level, shared across all `useGrist()` instances. Should it be per-provider?

**Vote:** keep module-level. Two providers in one app is undefined behavior anyway.

## Types

### 🅒 `GristRowRecord` `id` field

Today `id: number`. Grist also accepts string row ids in some contexts (formulas, references). Should we allow `number | string`?

**Vote:** keep `number`. The wire actually uses numbers; strings are rare formula-side artefacts that wouldn't appear in widget reads.

### 🅒 Mapping shape

`mappings: Record<string, string | string[]>`. The `string[]` only appears when `allowMultiple` is `true`. Should we encode this in the type with a tagged union?

```ts
type GristMapping =
  | { kind: "single"; colId: string }
  | { kind: "multi"; colIds: string[] }
```

Trade-off: clearer at consumption, more friction in the common case (`mappings.Title` becomes `mappings.Title.colId`).

**Vote:** keep flat. Document the `string | string[]` rule.

### 🅒 Generic defaults

`useGrist()` defaults `TRow` and `TMapped` to `GristRecordFields` (i.e. `Record<string, unknown>`). Should we default to `never` to force users to opt in?

**Vote:** keep `GristRecordFields`. Forcing generics on every call hurts DX.

## Replica document

### 🅑 Include `selection` by default

Today `useGristSchema()` includes `selection` when there's a current row. Should it always include the selection block (even when empty), so consumers can rely on its presence?

**Vote:** always include it (with `mode: "empty"`).

### 🅒 References in `GristReplicaColumn`

For ref/refList columns, today the type is `"Ref:Tasks"`. Should we expose the parsed `{ type: "Ref", target: "Tasks" }`?

**Vote:** add `references?: string` alongside `type: string` — backward-compatible, lets consumers skip parsing.

### 🅑 `widgetOptions` per column

`GristReplicaColumn.widgetOptions` is `Record<string, unknown>`. Should we type the common cases (Choice list values, numeric format, alignment)?

**Vote:** add a `GristReplicaColumnWidgetOptions` type with optional well-known fields, keep the index signature for unknown ones.

### 🅓 `.replica.json` vs `.grist.json`

We have both file extensions floating around. Pick one.

**Vote:** `.replica.json`. Document the migration in the changelog.

## Tests

### 🅑 `renderWithGrist` re-exports

Today users still need `import { screen } from "@testing-library/react"`. Should `renderWithGrist`'s entry re-export the testing-library surface?

**Vote:** yes, re-export `screen`, `fireEvent`, `waitFor`. Saves one import line.

### 🅑 Built-in matchers

Should we ship `expect.toHaveAppliedAction(...)` / `expect.toHaveEmittedEvent(...)` matchers?

**Vote:** no — provide `actionsOf` / `eventsOf` + `waitForEvent` and let the user write whatever assertion shape they want.

## Documentation

### 🅓 Quickstart for non-Vite stacks

Today the Getting Started page shows Vite + Next.js. Should we add Astro, Remix, plain HTML?

**Vote:** Add plain HTML (the most "outside" framework case). Skip Astro/Remix; same pattern as Next.js, link there.

### 🅓 Migration page

We'll iterate quickly during 0.x. Should we maintain a `MIGRATION.md` in the docs site?

**Vote:** yes, under `/design/migration.md` (to be added when we have a meaningful diff).

## Pending API tightenings

Forward-looking adjustments to the public surface that are decided
in principle but not yet scheduled into an iteration. When one is
picked up, it goes into [`TODO.md`](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/TODO.md), is agreed in
chat, and is removed from this list when shipped.

*(Empty. The next API changes are the 0.4.0 slimming in
[`TODO.md`](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/TODO.md).)*

## Out of scope

Decisions explicitly **not** on the table for 1.0:

- **Non-React framework support** — see principle #10.
- **A "form" hook** that binds inputs to `record` / `mapBack` — out of scope (user space).
- **Built-in toast / alert UI** — we ship descriptors; user owns rendering.
- **Multi-document support** — Grist plugin API doesn't expose this.
