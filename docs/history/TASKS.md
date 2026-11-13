# Task board

Every concrete piece of work needed to take the SDK to **1.0**. Tasks are grouped by milestone; statuses are updated when PRs land.

> **Convention:** each task has a stable id (`task-001`, …). Use the id in PR titles (`task-007: tighten safeParse defaults`) and changeset summaries.

Milestone themes and exit criteria: [Roadmap](./ROADMAP.md).

## How this relates to an active execution plan

This board owns the **SDK feature surface** on the road to 1.0. When a
separate, dated execution plan is active under
[`docs/planning/`](./docs/planning/) (e.g. an ecosystem or agent-readiness
review), that plan owns the **first-run and agent surfaces** instead —
onboarding, the CLI, the template, the docs site, discoverability. The two
overlap but are not the same, and neither supersedes the other. Where a plan
under `docs/planning/` disposes of a task below, the disposition is recorded
in that plan (see its own "what this does not supersede" section, if
present) rather than duplicated here — check there before assuming a `[ ]`
task is simply unstarted.

## Legend

| Status | Symbol | Meaning |
| --- | --- | --- |
| proposed | `[ ]` | Captured, not yet committed. |
| accepted | `[~]` | In a milestone, ready to start. |
| in-progress | `[/]` | PR open or partially landed on main. |
| done | `[x]` | Merged and verified. |

Size estimates: `S` (< 1 day), `M` (1–3 days), `L` (≥ 1 week).

---

## Milestone 0.2 — API surface alignment

### `task-001` Export every slice hook from the primary entry  ·  `[x]`  ·  `S`

- **Why.** `useGristStatus`, `useGristSelection`, `useGristWrites`, `useGristTheme` are documented and must be exported from `packages/core/src/sdk/index.ts`.
- **Design.** [/api/slice-hooks](/docs/sdk/api/slice-hooks)
- **Acceptance.**
  - `import { useGristStatus } from "grist-widget-sdk"` type-checks in `apps/playground`.
  - Each slice hook has a unit test under `packages/core/tests/sdk/`.
  - [/api/slice-hooks](/docs/sdk/api/slice-hooks) matches reality.
- **Status.** Landed — see `packages/core/tests/sdk/public-api.test.ts` and slice hook test files.

### `task-002` Add `currentTableId` to `useGristStatus`  ·  `[x]`  ·  `S`

- **Why.** Docs state `useGristStatus` carries `currentTableId`; the status hook is the natural home for table context.
- **Design.** [/design/open-questions](/docs/sdk/design/open-questions) — *Pending API tightenings*
- **Acceptance.**
  - `useGristStatus()` return type includes `currentTableId`, `currentTableLoading`, `refreshCurrentTable`, `tableError`.
  - Test verifies `currentTableId` updates when emulator switches tables.
- **Status.** Landed — `packages/core/tests/sdk/slice-status.test.tsx`.

### `task-003` Reverse-map `allowMultiple` with alert surface  ·  `[x]`  ·  `M`

- **Why.** `mapBack` must not silently skip `allowMultiple` columns.
- **Design.** [/design/open-questions](/docs/sdk/design/open-questions#mapback-and-allowmultiple-columns)
- **Acceptance.**
  - `mapBack` keeps current behavior (skip).
  - Skipped columns exposed as `mapBackSkipped` on `useGrist()` (and slice where applicable).
  - `getGristSdkAlertDescriptors(w)` returns a `kind: "warning"` descriptor when present.
  - Documented in [/guide/column-mapping](/docs/sdk/guide/column-mapping).
- **Status.** Landed — `packages/core/tests/sdk/map-back-allow-multiple.test.tsx`.

### `task-004` Normalise `safeParse` argument across reads  ·  `[x]`  ·  `S`

- **Why.** All entry points should accept `safeParse: boolean | GristSafeParseOptions`.
- **Acceptance.**
  - `GristFetchTableRowsOptions.safeParse` union.
  - Same union on `safeParseGristValues`, `safeParseGristTableData`, `useGristRowsFromTable`.
  - Tests cover both forms.
- **Status.** Landed in helpers; extend tests if gaps remain when closing 0.2.

### `task-005` Complete action builders for schema mutations  ·  `[x]`  ·  `S`

- **Why.** Table/document action builders shipped in 0.1.
- **Acceptance met.** See [/api/helpers](/docs/sdk/api/helpers#action-builders).

### `task-006` Stable test presets owned by the SDK  ·  `[x]`  ·  `M`

- **Why.** Shared fixtures instead of per-widget minimal documents.
- **Acceptance.**
  - `presets` exported from `grist-widget-sdk/emulator` and `/emulator/testing`.
  - `blank`, `todoList`, `contacts` factories in `packages/core/src/emulator/templates.ts`.
  - Used by playground tests and widgets.
- **Status.** Landed. (`presets.defaultTemplate()` also exists for neutral demos.)

### `task-007` Tighten `safeParse` defaults  ·  `[x]`  ·  `M`

- **Why.** With `columns` provided but `safeParse` omitted, types are decoded — document this contract explicitly.
- **Acceptance met.** `/guide/reading-data` *Columns vs safeParse* section; `grist-table-data.test.ts` covers plain decode vs safe-parse cells.

### `task-008` Audit `packages/core/src/sdk/index.ts` against design  ·  `[x]`  ·  `S`

- **Why.** Public exports must match docs; internals must not leak.
- **Acceptance met.** `public-api.test.ts` pins exports; `/design/api-surface.md` deleted; `tests/docs/structure.test.ts` enforces retirement; *Pending API tightenings* cleared for shipped 0.2 items.

---

## Milestone 0.3 — Testing & emulator hardening

### `task-010` Re-export testing-library surface  ·  `[x]`  ·  `S`

- **Why.** Single import path for widget tests.
- **Acceptance.**
  - `grist-widget-sdk/emulator/testing` re-exports `screen`, `fireEvent`, `waitFor`, `act`, `cleanup`.
  - Documented in [/emulator/api](/docs/emulator/api).
- **Status.** Landed — asserted in `public-api.test.ts`.

### `task-011` `waitForEvent` reliability + tests  ·  `[x]`  ·  `M`

- **Why.** Helper exists; needs a dedicated contract test suite.
- **Acceptance met.** Next-event-only wait (no history scan); kind overload + predicate form; timeout lists recent bus types; `wait-for-event.test.ts` covers all kinds.

### `task-012` Snapshot tests for `useGristSchema()` output  ·  `[x]`  ·  `M`

- **Why.** Schema replica is a primary surface; guard `buildReplicaDocumentFromDocApi` regressions (includes preset document shapes used in tests).
- **Acceptance met.** `use-grist-schema.snapshot.test.tsx` — 9 snapshots (3 presets × 3 row modes); `stableSchemaSnapshot` pins `generatedAt` / column order.

---

## Milestone 0.4 — Performance & re-render budget

### `task-020` Bench harness  ·  `[x]`  ·  `M`

- **Acceptance.**
  - `pnpm --filter grist-widget-sdk bench` runs a vitest + React profiler harness.
  - Reports renders/operation for: full-record subscription, slice subscription, write, schema fetch.
  - Output committed to `packages/core/bench/results.json` for diffing.

### `task-021` Slice-hook identity stability  ·  `[x]`  ·  `M`

- **Acceptance.**
  - Memoized child receiving each callable as a prop asserts zero re-renders across irrelevant slice updates.

### `task-022` Document render budget per slice  ·  `[x]`  ·  `S`

- **Acceptance.**
  - [/guide/performance](/docs/sdk/guide/performance) updated with measured renders / operation from the bench.

---

## Milestone 0.5 — Replica & schema upgrade

### `task-030` Add `references` to `GristReplicaColumn`  ·  `[ ]`  ·  `S`

- **Design.** [/design/open-questions](/docs/sdk/design/open-questions)
- **Acceptance.**
  - `GristReplicaColumn.references?: string` for `Ref:*` / `RefList:*`.
  - `parseDocument` validates `references` against `tables`.

### `task-031` Type `GristReplicaColumnWidgetOptions`  ·  `[ ]`  ·  `M`

- **Acceptance.**
  - Type with `choices?`, `numericFormat?`, `dateFormat?`, `alignment?`, plus index signature.
  - [/api/use-grist-schema](/docs/sdk/api/use-grist-schema) updated.

### `task-032` Include `selection` in `useGristSchema()` output  ·  `[ ]`  ·  `S`

- **Acceptance.**
  - Always present with at least `mode: "empty"`.

### `task-033` Migrate fixtures to `.replica.json`  ·  `[ ]`  ·  `S`

- **Acceptance.**
  - Repo-wide rename from `.grist.json` where applicable.
  - VS Code association in `apps/docs/files/conventions.md`.

### `task-034` `replica:dump` CLI  ·  `[ ]`  ·  `L`

- **Acceptance.**
  - `npx grist-widget-sdk replica:dump --doc <id>` prints / writes JSON.
  - Auth via `GRIST_API_KEY`.

---

## Milestone 0.6 — Examples & templates

### `task-040` Reorg `apps/playground` by Guide page  ·  `[ ]`  ·  `M`

- **Acceptance.**
  - One route per `/guide/` page (e.g. `/playground/column-mapping`).
  - Each route demonstrates exactly one concept end-to-end.

### `task-041` Cross-link Guide → playground  ·  `[ ]`  ·  `S`

- **Acceptance.**
  - Every `/guide/*` page ends with "Live example: `/playground/<page>`".

### `task-042` `create-grist-widget` scaffolder  ·  `[x]`  ·  `L`

- **Acceptance.**
  - `npm create grist-widget@latest my-widget` works.
  - Vite template with SDK preinstalled.

---

## Milestone 0.7 — Pre-1.0 freeze

### `task-050` Close every open question  ·  `[ ]`  ·  `M`

- **Acceptance.**
  - [/design/open-questions](/docs/sdk/design/open-questions) empty or repurposed; resolutions merged into guide/api/design pages.

### `task-051` Bundle-size budget  ·  `[ ]`  ·  `M`

- **Acceptance.**
  - `size-limit`: < 30 KB gzipped primary, < 10 KB `/advanced`, < 25 KB `/emulator`.
  - CI fails on regression.

### `task-052` Peer-dep widening  ·  `[ ]`  ·  `S`

- **Acceptance.**
  - `react@^18 || ^19 || ^20` in `peerDependencies`.
  - Build matrix verifies each.

### `task-053` Error-message audit  ·  `[ ]`  ·  `M`

- **Acceptance.**
  - Every `throw new Error(...)` includes method name + one-line hint; doc URL where useful.

### `task-054` Write `MIGRATION.md`  ·  `[ ]`  ·  `S`

- **Acceptance.**
  - `packages/core/MIGRATION.md` linked from docs workflow pages.

---

## Milestone 0.9 — Handshake state machine (SOTA)

Foundational refactor to standardise the widget ↔ Grist handshake and
synchronisation state across initialisation and runtime, with explicit
robustness guarantees under degraded networks.

### `task-060` Pure handshake state machine — foundation  ·  `[x]`  ·  `M`

- **Why.** A single source of truth for handshake/sync state. Replaces the
  ad-hoc `useState` ladder with a reducer + projection.
- **Design.** Five orthogonal axes (`LIFECYCLE`, `LINK`, `AUTHZ`, `CONFIG`,
  `SYNC`) feeding a pure reducer + status projection + capability derivation.
- **Acceptance.**
  - `packages/core/src/sdk/internal/handshake/` ships: `types`, `actions`,
    `mapping-resolver`, `reducer`, `derive`, `invariants`, `access`, `index`.
  - `gristReducer(snapshot, action, ctx)` is pure (no I/O, no globals).
  - `MappingResolver` ingests payloads in any order and produces a deterministic
    resolution by static source priority.
  - `deriveStatus()` reproduces the legacy 4-state status; `mergeGristStatus`
    routes through `deriveStatus()`.
  - `deriveCapabilities()` exposes `canRead` / `canRender` / `canWriteRecords`
    / `canWriteSchema` / `canFetchTable` / `hasFreshSelection` / mapping lists.
  - Test coverage:
    - `handshake-mapping-resolver.test.ts` — 24-permutation determinism +
      priority + generation drop + reset/bump.
    - `handshake-reducer.test.ts` — lifecycle, link (stale/lost), generation
      drop, idempotence, current-table local-error containment, mapping
      invalidation.
    - `handshake-derive.test.ts` — status projection + capability gates.
- **Status.** Landed — 50 new unit tests; full suite 209/209.

### `task-061` Effects layer (detect / negotiate / subscriptions / mappings)  ·  `[x]`  ·  `M`

- **Why.** Wire the pure machine to real Grist runtime: backoff-based detection,
  abortable negotiation, deterministic mapping ingestion, restart().
- **Landed.**
  - `internal/handshake/environment.ts` — `GristEnvironment` abstraction
    (browser adapter + virtual-clock `createTestEnvironment`).
  - `internal/handshake/effects/detect.ts` — exponential-backoff polling with
    `effectiveType`-adaptive budget; emits `DETECT_TICK` / `DETECT_AVAILABLE`
    / `DETECT_TIMEOUT` / `NOT_EMBEDDED`.
  - `internal/handshake/effects/negotiate.ts` — issues `grist.ready` with
    timeout + AbortSignal; emits `NEGOTIATE_*` actions.
  - `internal/handshake/effects/subscriptions.ts` — pluggable binder
    (default singletons; `noopSubscriptionsBinder` for tests) that feeds
    `STREAM_RECEIVED` with deterministic payload hashes.
  - `internal/handshake/effects/mappings.ts` — declare + `sectionApi.mappings()`
    + stream-payload ingestion + `MAPPING_TIMEOUT`.
  - `internal/handshake/manager.ts` — `GristHandshakeManager` (snapshot store,
    dispatcher, listeners, per-generation `AbortController`, `reload()`,
    `restart()`).
- **Tests.** 14 manager unit tests with virtual time (detect timeout/backoff,
  negotiate timeout/failure, generation drop, capability transitions,
  invariants).

### `task-062` Public `useGristHandshake()` + `useGristCapabilities()` hooks  ·  `[x]`  ·  `S`

- **Why.** Expose `GristWidgetSnapshot` + `GristCapabilities` to widgets that
  want to brand on fine-grained state (link lost banners, mapping prompts).
- **Landed.**
  - `low-level-hooks/use-grist-handshake.ts` — React adapter on
    `GristHandshakeManager` via `useSyncExternalStore`; returns
    `{ snapshot, status, error, capabilities, reload, restart }`.
  - Exports added to `/advanced` (hooks + every snapshot type).
- **Tests.** 3 emulator-driven integration tests in `tests/sdk/handshake-react.test.tsx`.

### `task-063` Heartbeat (RPC coalesced)  ·  `[x]`  ·  `S`

- **Why.** Detect dead link before the user notices. Coalesce probes with
  any successful RPC so we never burn a request when natural traffic proves
  the link.
- **Landed.**
  - `internal/handshake/effects/heartbeat.ts` — interval probe (default
    30 s) calling `grist.docApi.getDocName()`, with per-probe timeout
    (default 10 s), visibility-aware pause, `online` event resume, and
    `recordRpcSuccess()` / `recordRpcFailure()` API for external coalescing.
  - Wired into `GristHandshakeManager` — starts on `online` transition,
    cancels on any transition away. `heartbeat: false` disables entirely.
  - Public `manager.recordRpcSuccess()` / `manager.recordRpcFailure()` for
    future integration with the existing `useGristActions` / writes hooks.
- **Tests.** 11 heartbeat unit tests + 5 manager-integration tests under
  virtual time (stale → lost degradation, coalesce, visibility, online event).

### `task-064` Public `<GristHandshakeProvider>` + context hooks  ·  `[x]`  ·  `S`

- **Why.** Single shared manager per app tree so multiple consumers share one
  snapshot (vs spawning a manager per `useGristHandshake()` call).
- **Landed.**
  - `components/grist-handshake-provider.tsx` — provider + context.
  - `useGristHandshakeContext()` (throws when missing) +
    `useGristHandshakeContextOptional()` (returns `null`).
  - Coexists with `<GristWidgetProvider>`; no breaking change to legacy.
- **Tests.** 4 emulator-driven tests covering shared context, optional
  hook semantics, and the throwing variant.

### `task-065` Migrate `<GristWidgetProvider>` to the handshake manager  ·  `[x]`  ·  `M`

- **Why.** Until this task, `<GristWidgetProvider>` still drove its slice
  composer via the pre-FSM `useGristAvailability` + `useGristReady` chain.
  We want every existing widget to transparently benefit from the FSM's
  generation discipline, mapping resolver, and heartbeat — without changing
  the public API.
- **Landed.**
  - `internal/handshake-manager-context.ts` — private React context that
    holds the manager owned by `<GristWidgetProvider>`. Not exported from
    the public barrel.
  - `<GristWidgetProvider>` allocates a single `GristHandshakeManager` on
    first mount (via `useRef`), starts it in `useEffect`, and wraps its
    children in `GristHandshakeManagerContext.Provider`. Manager options are
    derived from the public `UseGristOptions` (requiredAccess, columns,
    allowSelectBy, hasCustomOptions, onEditOptions, availability tuning →
    `detect.{pollSequenceMs, budgetMs}`).
  - The negotiate effect now accepts an optional `readyImpl`. The provider
    threads `ensureGristReady` so a standalone `useGristReady()` mounted
    elsewhere on the page coalesces with the manager's ready call.
  - `manager.reload()` gains an `onBeforeReload` hook; the provider wires it
    to `resetGristReadySingleton()` so soft reloads actually re-issue
    `grist.ready` (otherwise the cached promise would short-circuit).
  - `useGristCore` consumes `GristHandshakeManagerContext` via
    `useSyncExternalStore` and projects the snapshot into the legacy
    `{ status, isAvailable, isReady, error, docApi, reload }` shape. Outside
    the provider, it falls back to the pre-FSM hooks byte-for-byte (no
    behaviour change for escape-hatch users).
  - `resetGristReadySingleton()` exported alongside the existing
    `resetGristReadyCacheForTests` alias.
- **Tests.** All 259 tests pass on 10/10 consecutive runs after the migration.
  Two pre-existing flaky integration tests (`tests/sdk/sdk-react.test.tsx`,
  `tests/sdk/column-mapping-pending.test.tsx`) were tightened to wait on the
  fully-settled state in a single `waitFor` block, because
  `pendingColumnMappingStatus.ok` is `true` (no `missing` columns reported
  yet) and the original single-shot assertion was racing against the
  transient pending-but-ok window. No regressions in slice tests,
  property-based tests, or the heartbeat suite.
- **Follow-ups.** Real-widget validation (the developer will exercise the
  bundled `world-map`, `v0-minimal-demo`, and `create-email-draft` widgets
  before publishing). Documentation refresh tracked under `task-068`.
  Auto-coalescence of heartbeat with `useGristActions` / writes tracked
  under `task-066`.

### `task-066` Heartbeat auto-coalescence via slice hooks  ·  `[x]`  ·  `M`

- **Why.** The handshake manager runs a heartbeat that probes
  `grist.docApi.getDocName()` every 30 s. Chatty widgets (write-heavy /
  read-heavy) already prove the link healthy on every RPC; the heartbeat
  shouldn't burn extra requests in that case. Conversely, when a real
  RPC fails, the link signal should degrade *immediately* rather than
  waiting for the interval.
- **Landed.**
  - `internal/hooks/use-rpc-heartbeat-coalesce.ts` — new helper hook
    `useRpcHeartbeatCoalesce()` that returns a stable wrapper
    `<T>(fn: () => Promise<T>) => Promise<T>`. On resolve it calls
    `manager.recordRpcSuccess()`, on reject `manager.recordRpcFailure()`
    and re-throws. Reads the manager from the internal handshake context
    — outside a provider it's a zero-cost passthrough.
  - All slice hooks wired through `coalesceRpc`: writes
    (`useGristTableOpsBound`: `applyActions`, `table.*`, `getTable(…).*`),
    reads (`useGristReads`: `fetchTable`, `fetchTableRows`, `fetchRow`,
    `listTables`, `getDocName`, `buildReplicaDocumentFromDocApi`,
    `fetchSelectedTable`, `fetchSelectedRecord`), widget options
    (`useGristWidgetOptionsApi`: all six), linking (`useGristLinking`:
    `setCursorPosition`, `setLinkedRowSelection`), section
    (`useGristSectionApi`: `configure`, `refreshMappings`), attachments
    (`useGristAttachmentsRest`: `getAttachmentUrl`, `fetchAttachmentBase64`,
    `fetchAttachmentBlob`, `getAccessToken`, `fetchWithAuth`), current
    table (`useGristCurrentTable.refreshCurrentTable`), and the
    mid-level `useGristActions.apply`.
  - `<GristWidgetProvider>` was restructured into a two-layer component
    (`GristWidgetContextTree` under the manager) so the manager context is mounted
    *before* the slice composer runs. Without this, `useRpcHeartbeatCoalesce()`
    inside the slices resolved to `null` and coalescence silently
    no-op'd. The integration test
    `tests/sdk/handshake-rpc-coalesce.test.tsx` pins that contract
    (writes / reads / linking / failures all reported to the manager).
  - Defensive `typeof grist === "undefined"` guards added to
    `useGristCurrentTable` and `useGristSelection` so late passive
    effects (firing after a sibling test's `emulator.dispose()`) no
    longer surface `ReferenceError: grist is not defined`. Pre-existing
    flake; fully eliminated in the 10/10 stability loop.
  - Unit tests (`tests/unit/handshake-rpc-heartbeat-coalesce.test.tsx`) cover
    the success/failure/no-manager/concurrent code paths of the
    coalesce helper itself.
- **Tests.** 269 tests pass on 10/10 consecutive runs. `tsc --noEmit`
  clean. SDK build clean. Docs build clean.

### `task-067` Property-based tests (fast-check)  ·  `[x]`  ·  `S`

- **Why.** Lock in race-condition invariants of the FSM with shrinkable
  counter-examples — beyond the 24 hand-crafted permutations, we now cover
  thousands of random traces per CI run.
- **Landed.** `packages/core/tests/unit/handshake-properties.test.ts` — 12
  property tests across 5 families:
  1. Mapping resolver determinism — resolution depends only on the SET of
     payloads, not their arrival order; verified across 200 runs of
     auto-generated `(declared × payloads)` pairs.
  2. Generation gate — stale-generation payloads are never reflected (200 runs).
  3. Reducer idempotence on `STREAM_RECEIVED` (100 runs).
  4. `terminated` is absorbing under any random follow-up action (100 runs).
  5. Fuzz / chaos — 200-run sequences of random actions never throw; status
     is always projectable; generation is monotonically non-decreasing;
     `link.state` stays in domain.
  Plus pure derivation contracts: `deriveStatus` totality (300 runs),
  capability conjunctivity `canWriteSchema ⇒ canWriteRecords ⇒ canRender ⇒
  canRead` (300 runs), and `incomplete` mappings never escalating to global
  `error` (100 runs).
- **Dev dep.** `fast-check@^4.8.0` added to `packages/core`.

### `task-068` Public docs for the handshake module  ·  `[x]`  ·  `M`

- **Why.** The new `useGristHandshake()` / `useGristCapabilities()` /
  `<GristHandshakeProvider>` hooks landed in 0.2.0 with no companion
  documentation. The existing guide pages also still described the old
  `useGristAvailability` + `useGristReady` chain as the FSM's
  implementation. With `task-065` making the FSM the default backing
  for `<GristWidgetProvider>` and `task-066` cabling auto-coalescence
  end-to-end, the public docs needed a refresh.
- **Landed.**
  - `apps/docs/api/handshake.md` — new API reference page. Covers when
    to use the handshake module vs the default surface, the provider +
    standalone hooks, the snapshot shape (lifecycle / link / authz /
    config / sync), capabilities + the conjunctive chain, heartbeat
    coalescence (auto via slice hooks + manual via `recordRpcSuccess` /
    `recordRpcFailure`), disabling the heartbeat, `reload()` vs
    `restart()`, and generation discipline.
  - `apps/docs/guide/handshake.md` — new conceptual guide. Tells the
    five-axis story, walks through the capability chain with a small
    example, explains link states + heartbeat coalescence, mapping
    states beyond `columnMappingStatus`, generation as a discipline for
    custom effect code, and a "choosing your provider" decision table.
  - `apps/docs/.vitepress/config.mts` — handshake guide listed under
    Guide → Advanced topics; handshake API ref listed in the unified
    Reference sidebar.
  - Cross-links from `apps/docs/api/index.md`,
    `apps/docs/api/provider-boundary.md`, `apps/docs/guide/concepts.md`,
    `apps/docs/guide/error-handling.md` to the new pages.
  - `provider-boundary.md` updated to describe the manager-backed
    implementation of `<GristWidgetProvider>` (was previously described
    in terms of `useGristAvailability` + `useGristReady`).
- **Tests.** `pnpm --filter docs build` clean.

### `task-069` Full SOTA — remove legacy connectivity path  ·  `[x]`  ·  `M`

- **Why.** After task-065/066 the provider ran the FSM internally but
  `useGristCore` still fell back to `useGristAvailability` + `useGristReady`
  outside the provider; compose still applied `mergeGristStatus()` (which
  could override FSM `deriveStatus` on `tableError`); mappings were tracked
  twice (FSM + `useGristSelection` bootstrap); `CURRENT_TABLE_*` actions were
  never dispatched from production hooks.
- **Landed.**
  - `useGristManager()` — single entry point (provider context or embedded
    ref-counted manager). `useGristCore` always projects the FSM snapshot.
  - `internal/build-manager-options.ts`, `internal/embedded-handshake-manager.ts`.
  - Compose uses `useGristCore` status directly (no `mergeGristStatus`).
  - `useGristSelection` — `deriveColumnMappingStatus` / `extractResolvedMappings`
    from FSM; narrow mapping subscription (stable slice identity on unrelated
    link/heartbeat updates).
  - `useGristCurrentTable` — dispatches `CURRENT_TABLE_*`, reads sync axis.
  - `useGristReady` / `useGristAvailability` — thin `useGristCore` wrappers.
  - Mid-level `useGristTableOps` / `useGristRowsFromTable` — `useRpcHeartbeatCoalesce`.
  - Test resets: `resetEmbeddedHandshakeManagerForTests` in unit setup +
    `renderWithGrist` cleanup.
- **Tests.** 267/267; `tsc` + build clean.

### `task-070` Handshake-aware boundary + alert shell  ·  `[x]`  ·  `M`

- **Why.** Blocking chrome (`<GristBoundary>`) and non-blocking callouts
  (`getGristSdkAlertDescriptors`) should reflect FSM phase / link / mapping /
  current-table state, not only the legacy four-state `status`.
- **Landed.**
  - `deriveBoundaryView` / `deriveBoundaryBootLabel` (`helpers/grist-boundary-view.ts`).
  - Extended `getGristSdkAlertDescriptors` + `useGristSdkAlertDescriptors`
    (mapping-pending, mapping-unreported, link-stale, current-table-error;
    `title` / `severity` on descriptors).
  - `<GristBoundary>` — phase-aware boot label; `gate="canRender"` +
    `preparingFallback`.
  - Template + widgets + playground `GristSdkAlerts` shadcn shell updated.
  - Docs: `error-handling.md`, `provider-boundary.md`.

---

## Milestone 0.8 — Optionals

Nice-to-have work that improves rigour or DX but is **not** required for 1.0 exit criteria. Pick these up when the critical path (0.4–0.7) is clear.

### `task-013` Emulator parity audit  ·  `[ ]`  ·  `L`

- **Why.** Emulator should implement every `grist.*` method the SDK calls (or fail loudly).
- **Acceptance.**
  - `tests/unit/emulator-coverage.test.ts` iterates the documented method set.
  - Unimplemented methods throw a descriptive error in the emulator.

---

## Cross-cutting / continuous

### `task-090` Keep changesets current  ·  ongoing

- Every PR touching published-package source adds a `pnpm changeset` entry (enforced by `require-changeset.yml`).

### `task-091` Lint setup  ·  `[x]`  ·  `M`

- **Acceptance met.**
  - `pnpm --filter grist-widget-sdk lint` passes.
  - CI gate added — `core-ci.yml` runs `lint`.
- **Status.** Landed — `eslint.config.*` now exists in all five workspaces (`apps/www`, `apps/playground`, `templates/grist-widget-template-vite`, `packages/core`, `packages/create-grist-widget`); `packages/create-grist-widget` also gained its own `create-grist-widget-ci.yml` (nothing ran its tests or lint in CI before). Since 2026-10-31, `workspace-lint.yml` gates the lint of the three remaining workspaces — `apps/www` (its build already ran on Cloudflare Pages, its lint nowhere), `templates/grist-widget-template-vite` and `apps/playground` — so every workspace's lint now runs in CI.

### `task-092` GitHub Actions release workflow  ·  `[x]`  ·  `M`

- **Acceptance.**
  - `release.yml` on push to `main`; npm publish; GitHub release body from changelog.
- **Status.** Landed, and stronger than originally scoped — `release.yml` is Changesets-driven (not a bare tag push) and publishes via npm Trusted Publishing (OIDC), not a stored `NPM_TOKEN`. See `RELEASING.md`.

---

## Backlog (proposed, no milestone)

### `task-100` Server-rendered status snapshot

For Next.js hosts, support a server-rendered "booting" frame that hydrates client-side.

### `task-101` "Form" hook

Out-of-scope per [/design/principles](/docs/sdk/design/principles). Tracked to acknowledge requests.

### `task-102` Realtime cross-table subscription

Plugin API limitation — tracked in case Grist adds row-change events for non-section tables.

---

## How to update this file

1. Add a task with `[ ] proposed`, unique id, "why", design link, acceptance criteria.
2. Move to a milestone when accepting.
3. Bump status when work starts / finishes (`[/]` → `[x]`).
4. **Don't delete done tasks** until the minor release ships; then summarize in the changelog.
