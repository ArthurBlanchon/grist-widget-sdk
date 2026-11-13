# Roadmap

High-level plan from the current **0.3** (published on npm) to a stable **1.0** (first production-grade release). This document is an **ordering of priorities**, not a schedule — slipping a milestone is fine; reordering one is a deliberate decision recorded here and in the [Task board](./TASKS.md).

**How this fits the workflow**

| File (repo root) | Role |
| --- | --- |
| `ROADMAP.md` | Milestones 0.2 → 1.0 — themes, scope, exit criteria (this file). |
| `TASKS.md` | Concrete tasks with stable ids (`task-001`, …) and status symbols — the SDK-1.0 feature backlog. |
| `docs/planning/` | An active execution plan, when one is in flight — see the note atop `TASKS.md`. |
| `pnpm changeset` | Shipped history, per package — see [`AGENTS.md`](./AGENTS.md). |

Pick a task from [Tasks](./TASKS.md) → align scope in chat → implement → run `pnpm changeset` and mark the task `[x]`. See [Contributing](./CONTRIBUTING.md).

---

## Progress snapshot (August 2026)

| Milestone | Theme | Status |
| --- | --- | --- |
| **0.2** | API surface alignment | **Done on main** — task-007/008 landed; shipped in `v0.2.0`. |
| **0.3** | Testing & emulator hardening | **Done on main** — RTL re-exports, `waitForEvent`, presets, schema snapshots. |
| **0.4** | Performance & re-render budget | **Done on main** — bench harness, slice identity tests, `/guide/performance` budgets. |
| **0.5** | Replica & schema upgrade | Not started |
| **0.6** | Examples & templates | Partially — playground demos + Guide exist, and `create-grist-widget` now scaffolds the template; per-page playground routes still open. |
| **0.7** | Pre-1.0 freeze | Not started |
| **0.8** | Optionals | Backlog — rigour/DX not blocking 1.0 ([task-013](./TASKS.md#task-013) emulator parity audit). |
| **1.0** | Stable surface | Target |

Package version today: `0.3.3` in `packages/core/package.json` and `packages/create-grist-widget/package.json` (they version together). Released history: [`packages/core/CHANGELOG.md`](./packages/core/CHANGELOG.md).

---

## Versioning model

- **0.x** — fast iteration, breaking changes acceptable, no migration code.
- **1.0** — frozen public surface. Anything in [/docs/sdk/api/](/docs/sdk/api/) becomes a contract.
- **1.x** — additive features, deprecations announced one minor in advance, removals only in majors.

Release mechanics: `pnpm changeset` on every user-visible PR; merging to `main` opens/updates a "Version Packages" PR (via `changesets/action`); merging *that* PR bumps versions, updates each package's `CHANGELOG.md`, and publishes to npm via OIDC trusted publishing — no manual version bump or `publish` step. See [Releasing](/docs/contributing/releasing) and `RELEASING.md`.

---

## 0.2 — API surface alignment

**Theme:** make the implementation match the documented target surface.

**Scope:**

- All four slice hooks (`useGristStatus`, `useGristSelection`, `useGristWrites`, `useGristTheme`) shipped from the primary entry, with documented re-render contracts.
- `useGristStatus()` carries `currentTableId` and friends.
- `mapBack(allowMultiple)` skips + surfaces a warning via `getGristSdkAlertDescriptors` (`mapBackSkipped` on `useGrist()`).
- `safeParse` options accept either `true` or `GristSafeParseOptions` everywhere.
- Action builders complete (records / columns / tables / document) per [/docs/sdk/api/helpers](/docs/sdk/api/helpers).
- `presets.blank()` / `presets.todoList()` / `presets.contacts()` stable.

**Out of scope:** documentation reorganisation (largely done in 0.1 / current docs iteration).

**Exit criteria:**

- `pnpm --filter grist-widget-sdk build && test` green.
- Every public symbol enumerated in `packages/core/tests/sdk/public-api.test.ts` matches [/docs/sdk/api/](/docs/sdk/api/).
- `apps/playground` consumes only the documented surface (no deep imports into package internals).

**Linked tasks:** [Task board](./TASKS.md) — milestone `0.2`.

---

## 0.3 — Testing & emulator hardening

**Theme:** make `renderWithGrist` a credible alternative to manual Grist testing.

**Scope:**

- `renderWithGrist` re-exports the testing-library surface (`screen`, `fireEvent`, `waitFor`, `act`, `cleanup`).
- `waitForEvent`, `actionsOf`, `eventsOf` documented and covered by unit tests.
- A minimum of three preset documents (`blank`, `todoList`, `contacts`) used by the playground + tests.
- Snapshot tests for the schema replica produced by `useGristSchema()`.

**Out of scope (moved to 0.8):** exhaustive emulator ↔ plugin API parity audit ([task-013](./TASKS.md#task-013)).

**Exit criteria:**

- A new widget can be authored end-to-end (read + write + options) with zero mocks beyond `renderWithGrist`.

---

## 0.4 — Performance & re-render budget

**Theme:** measurable performance guarantees.

**Scope:**

- A `pnpm --filter grist-widget-sdk bench` task that runs reproducible React render benchmarks.
- Documented "render budget" per slice hook in [/docs/sdk/guide/performance](/docs/sdk/guide/performance).
- Stability of returned function identities (`table`, `getTable`, `applyActions`, `mapBack`, etc.) verified by tests.
- Memoization of `getTable(id)` extended to all per-id factories.

**Exit criteria:**

- A 1000-row `records` subscription does not re-trigger downstream memoized components when the selection changes within the same list.

---

## 0.5 — Replica & schema upgrade

**Theme:** make the replica format complete enough to power tests, LLMs, and type generation without further changes.

**Scope:**

- `GristReplicaColumn.references?: string` added for ref/refList columns.
- `GristReplicaColumnWidgetOptions` type with well-known fields.
- `useGristSchema()` always includes `selection` (with `mode: "empty"` when absent).
- A `.replica.json` fixture spec documented; `.grist.json` deprecated.
- A `pnpm --filter grist-widget-sdk replica:dump` CLI that prints a replica from any deployed widget.

**Exit criteria:**

- Round-trip: `getDocumentJson(replica)` → `parseDocument(json)` → emulator → widget works in tests with full data fidelity.

---

## 0.6 — Examples & templates

**Theme:** every concept in the Guide has a runnable example.

**Scope:**

- `templates/grist-widget-template-vite` updated to the new API.
- `apps/playground` reorganised into one example per page, each one demonstrating exactly one Guide page.
- Cross-linked: every `/guide/` page ends with "see live example: …".
- A `create-grist-widget` CLI (or one-liner `npm create …`) that scaffolds the template.

**Exit criteria:**

- A new user can read the Guide top-to-bottom and find a working example for every code snippet.

---

## 0.7 — Pre-1.0 freeze

**Theme:** lock the public surface, fix anything that would otherwise be a 1.x breaking change.

**Scope:**

- Close every entry in [/docs/sdk/design/open-questions](/docs/sdk/design/open-questions).
- Audit every export from `packages/core/src/sdk/index.ts` against the public API test + [/docs/sdk/api/](/docs/sdk/api/). Remove or rename anything inconsistent.
- Bundle-size budget: < 30 KB gzipped for the primary entry.
- Peer-dep range: `react@^18 || ^19 || ^20`.
- Final pass at error messages — every thrown `Error` includes the failing call site and (where useful) a doc link.

**Exit criteria:**

- A two-week soak with no surface changes.
- `MIGRATION.md` written if any 0.x → 1.0 transition needs guidance.

---

## 0.8 — Optionals

**Theme:** polish and rigour that helps maintainers and power users but does not block shipping 1.0.

**Scope:**

- Emulator parity audit: every `grist.*` method the SDK calls is implemented or throws a clear error ([task-013](./TASKS.md#task-013)).

**Exit criteria:**

- None required for 1.0 — tasks here ship when useful.

---

## 1.0 — Stable surface

Cut from the last 0.7 patch, no surface changes. Announcements:

- Update the README and landing page to drop the "alpha" warning.
- Tag `v1.0.0`, publish to npm with `latest`.
- Freeze the docs site (the `/design/open-questions` page should be empty or repurposed for 1.x discussions).
- Open `/design/v2/` for any future major-version proposals.

---

## 1.x — Additive era

- Deprecations announced one minor in advance via `console.warn` + `/design/open-questions`.
- Removals only in `2.0`.
- New features land behind named exports — no flag-based opt-ins.

The roadmap from here is open and lives in the same [Task board](./TASKS.md).

---

## Cross-cutting

These don't fit cleanly in one milestone but ship continuously:

- **Documentation** — every PR that touches behavior updates the relevant `/docs/sdk/guide/`, `/docs/sdk/api/`, `/docs/sdk/design/` pages.
- **Changelog** — every PR touching published-package source adds a `pnpm changeset` entry.
- **CI** — every PR runs `build`, `test`, `tsc --noEmit`; `lint` runs in `apps/www`, `apps/playground`, and the template ([task-091](./TASKS.md#task-091) — `packages/core` still has none).
- **Browser support** — modern evergreen browsers + the Grist desktop / web hosts. No polyfills.
