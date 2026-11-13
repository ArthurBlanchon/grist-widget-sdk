---
title: Architecture review — 2026-11-09
---

# Architecture review — 2026-11-09

> **Status: accepted** on 2026-11-09, with two points worked out further:
> typed reads without full access (§3.C) and real-Grist demos with
> grist-static (§3.D). Scope:
> the whole monorepo (SDK, emulator, app chrome, CLI, template, CI, site,
> registry), read for performance, robustness, security and simplicity, with
> the core design open to challenge. The ordered work it leads to is in
> [`TODO.md`](../../TODO.md).

## 1. Verdict

**Keep the project; don't restart it.** The core idea is right and now proven
on real widgets: React hooks over Grist's plugin API, one `useGrist()` entry
point, a `GristBoundary` that hides connection states, `mountGristWidget()`
for the wiring, a scaffold that deploys itself, and checks that run real
widgets in a real Grist. No library does this better (the official
`grist-plugin-api` npm package is a 2022 `0.0.1`), and the six widgets, the
template, the CLI, the registry and the real-widget CI are assets a rewrite
would throw away.

**But the SDK is about twice the size the job needs.** Most of the weight is
in machinery built for problems the runtime doesn't have, and in public
surface nobody uses. Three structural moves, done in place behind the
real-widget safety net, buy most of the gain:

1. **A synchronous runtime** instead of the handshake state machine (§3.A).
2. **A small public API** instead of ~195 root exports and an `advanced`
   layer (§3.B), with typed reads that need no full access and no `zod`
   (§3.C).
3. **The emulator as a test harness only**: retire the playground, the
   iframe transport and the devtools; demos run in a real Grist, served
   statically by grist-static (§3.D).

Expected result: `packages/core/src` from 16.5k to roughly 7–8k lines, the
SDK test suite from 8k to roughly 4–5k lines of contract tests, a
hello-world widget about 23 KB gzip lighter, and one CI gate instead of
path-filtered required checks.

## 2. The project in numbers (2026-11-09, `main`)

| Area | Files | Lines |
| --- | --- | --- |
| `packages/core/src` (SDK, emulator, app chrome) | 131 | 16,505 |
| `packages/core/tests` | 61 | 8,092 |
| `packages/create-grist-widget` (src, bin, scripts) | 11 | 2,720 |
| `templates/grist-widget-template-vite` | 34 | 1,832 |
| `examples/` (17 widgets) | 22 | 3,259 |
| `apps/playground` | 54 | 5,383 |
| `apps/www` (site, 42 docs pages) | 95 | 8,502 |
| `scripts/` | 18 | 2,772 |
| `.github/workflows` (14) | 14 | 1,277 |

- **Public surface:** the root entry exports about 195 names; `./advanced`
  adds the low- and mid-level hooks; the emulator has three subpaths.
- **Use:** the six real widgets, the 17 examples and the template import
  **44** distinct names in total, centred on `useGrist`, `useWidgetMetadata`,
  `useGristSchema`, `mountGristWidget` and `smokeTestWidget`. `./advanced` is
  imported by the docs only.
- **Tests:** 368 SDK tests pass; line coverage 69 % (branches 57 %). The
  0 % areas are exactly the unused ones: the mid- and low-level hooks
  (~300 lines) and the emulator devtools.
- **Bundle:** the template's hello-world widget ships 431 KB minified,
  129 KB gzip; `zod` alone is 85 KB minified, **23 KB gzip** of it (measured
  by building with `zod` stubbed out).

## 3. Findings

### A. The runtime solves problems it doesn't have (done)

The handshake is a reducer (577 lines) driven by a manager (350) and five
effects — detect, negotiate, subscriptions, mappings, heartbeat — with
generations, per-generation `AbortController`s, an environment abstraction
for virtual clocks, and 593 lines of property tests.

- **Detection polls for something that is already there or never will be.**
  The template loads `grist-plugin-api.js` with a classic, blocking
  `<script>` before the module script, so `window.grist` exists when
  `main.tsx` runs — or the script failed and polling for 30 to 120 s (the
  adaptive budget) cannot recover it. Detection can be one synchronous check.
- **The heartbeat probes a channel that can't drop on its own.** Every 30 s
  it calls `docApi.getDocName()`; it came from a planned design task
  (task-063), not an incident. The widget's iframe lives and dies with the
  Grist page; a real RPC failure surfaces on the call that failed.
- **Generations and reload/restart** guard races that a single
  `grist.ready()` per page load doesn't produce.

**Proposal:** one `connect()` that checks `window.grist` and embedding
synchronously, calls `ready()` once, subscribes to records, options and
mappings, and feeds one store read through `useSyncExternalStore`. States:
`not-embedded`, `unavailable` (no plugin API), `connecting` (ready sent, no
data yet), `ready`, `error` — plus the mapping and access alerts the boundary
already shows. Same `useGrist()` result for widgets; an estimated 300–400
lines instead of ~2,000.

**Done:** `src/sdk/runtime/` (store, host streams, derivations, methods),
about 600 lines with the React layer. Renders dropped (cursor move 3 → 1,
schema reload 2 → 1). Contract tests (`tests/contract/`) pin each member;
writing them found five bugs, fixed with it: `fetchSelectedTable()`
returned rows while typed as columns (world-map's and gantt's fallback read
nothing), `mode` stuck on `"new-row"`, and three emulator divergences from
Grist (`setOptions` merged instead of replacing, `onRecord(null)` on the
add-row, `mapColumnNames` returning `{}` for unmapped columns), plus the
emulator reporting read-table access to full-access widgets. The six
reference widgets typecheck, test, build and render in a real Grist on it.
`packages/core/src` went from 16.5k to 8.3k lines, its tests from 8.1k to
4.4k.

### B. The public surface is much larger than its use (done)

- About 195 root exports, of which widgets use 44: boundary-view derivation
  helpers, alert formatters, replica builders and normalizers, user-action
  builders, value codecs, schema builders. Each is a compatibility promise
  and a page of docs.
- `./advanced` (low-level and mid-level hooks, handshake types) is used by
  no widget and has 0 % coverage.
- `useGrist()` returns about 60 members, with overlapping families: seven
  widget-options functions (`getWidgetOptions`, `getWidgetOption`,
  `setWidgetOption`, `setWidgetOptions`, `patchWidgetOptions`,
  `clearWidgetOptions`, plus the `widgetOptions` value), several read paths
  (`fetchTable`, `fetchTableRows`, `fetchRow`, `fetchSelectedTable`,
  `fetchSelectedRecord`, `buildReplicaDocumentFromDocApi`).

**Proposal (0.4.0, breaking, allowed in 0.x):** a root entry of about 30
names — `useGrist`, `useGristSchema`, `useWidgetMetadata`,
`GristWidgetProvider`, `GristBoundary`, the core types, and the handful of
helpers widgets do use (attachments, column actions, `tableDataToRows`,
choice lists). Delete `./advanced` and the low/mid-level hooks. Keep
`useGrist()` as the one object — it is what makes widgets easy to write,
for people and for agents — but collapse duplicate families (widget options
→ `widgetOptions` + `setWidgetOptions(patch)`). Existing widgets move with
one `upgrade` and a changeset that says what to replace.

**Done**, with one change from the proposal: the widget-options family is
`widgetOptions` + `setWidgetOptions` (replace) + `patchWidgetOptions`
(merge), not a `setWidgetOptions(patch)` that would silently change an
existing name's meaning. The root entry exports 29 runtime names; every
member a reference widget uses stayed, so the six need no change.

### C. Every widget pays for validation it doesn't use — and can't use it read-only (done)

`grist-table-data.ts`, on `useGrist()`'s read path, imports
`grist-safe-parse.ts`, which imports `zod`: 23 KB gzip of every widget. And
the safe-parse needs each column's type from `_grist_Tables_column`, which
only a widget with full access can read. A read-only widget gets no type
checking at all.

Two facts make full access unnecessary for the columns a widget maps:

- **The declared types are the contract.** `GRIST_OPTIONS.columns` gives
  each mapped column a `type`, and Grist's mapping UI only offers columns of
  that type. A widget already knows the type of every column it maps.
- **Typed cells describe themselves.** With `cellFormat: "typed"` (Grist's
  `FetchSelectedOptions`, honoured for custom widgets), a Date arrives as
  `["d", seconds]`, a RefList as `["r", tableId, ids]`, a formula error as
  `["E", …]`; older Grist versions send the in-between default format, where
  only RefList and Attachments stay plain.

**Design:**

1. **A small decoder per Grist type** (Text, Numeric, Int, Bool, Date,
   DateTime, Choice, ChoiceList, Ref, RefList, Attachments, Any), with no
   dependency. It turns a cell into its JS value and reports a cell that
   doesn't match its declared type as an issue on that cell, never a throw —
   which also covers a column whose type changed after it was mapped.
2. **Row types inferred from the declaration.** A `const` `GRIST_OPTIONS`
   gives `mappedRecord` / `mappedRecords` their TypeScript type; one
   declaration types and checks the data.
3. **Extra rules through Standard Schema, optional.** A widget that wants
   more (an email, a range) passes any
   [Standard Schema](https://standardschema.dev) validator — zod 4, valibot
   and arktype all implement it. The SDK depends on none of them; a widget
   ships `zod` only if it uses it.
4. **Full access only for metadata:** a Choice's allowed values, a Ref's
   target table, unmapped columns (`useGristSchema`, unchanged).

The `zod` safe-parse helpers (`safeParseGristTableData`, `fetchTableRows`'s
`safeParse`) go; a size budget in CI on the template's build keeps the
number from creeping back.

**Done**, simpler than designed: measured in Grist 1.7.22 with a column of
every type, the plugin API's default (decoded) values already say what they
are — a `Date`, a `Reference` with its `rowId`, a list of ids, a
`RaisedException`, the raw text of an invalid cell — so `cellFormat: "typed"`
adds nothing but another RefList shape, and isn't used (older Grist versions
work too). `runtime/cells.ts` checks each mapped cell (about 200 lines, no
dependency); `mappedRecords` and `cellIssues` join `useGrist()`;
`GristMappedRow<typeof GRIST_OPTIONS>` types them; `UseGristOptions.schema`
takes a Standard Schema. zod is gone from the SDK's widget path (it stays in
the emulator's document validator, used by tests). The template's build went
from 129 KB to 94 KB gzip, and `size` in `ci.yml` fails above 100 KB.

### D. The emulator does two jobs; only one still pays (done)

The emulator (3.7k lines) is the engine of `renderWithGrist` and
`smokeTestWidget`: fast, headless widget tests. That job is essential.

It is also the engine of the playground (5.4k lines), the iframe transport
and the devtools inspector (0 % coverage): an emulated live preview, built
twice for the site's two origins and linked about 31 times from the docs.
That contradicts the template's own rule — never a seeded preview, because
an emulator can't guarantee parity — and it is now redundant: `pnpm demo`
runs a widget in a real Grist, and the Real widgets workflow checks real
widgets in a pinned Grist every week.

**Proposal:** keep the emulator as a test harness (document, action engine,
inline transport, `./testing`). Retire the playground, the iframe transport
and the devtools. The 17 examples become seeds for the core widget library
(the next project).

**Demos in a real Grist, with no server: grist-static.**
[grist-static](https://github.com/gristlabs/grist-static) (Apache-2.0, npm
`grist-static`) runs Grist itself in the browser (its data engine through
Pyodide), loaded from static files, with a `.grist` document as input.
Tried on 2026-11-09: a document generated by `pnpm demo`'s Docker Grist,
with a custom section pointing at world-map's published `/latest/`, opened
in grist-static 0.1.6 served from `127.0.0.1`; the widget rendered its data
next to the real grid, with no page error. It is Grist, not an emulation,
so there is no parity to keep.

**Done** (the playground's retirement, with it):

- **`create-grist-widget demo --save`** writes `public/demo/demo.grist` (the
  same Docker Grist and generated document as `pnpm demo`) and
  `public/demo/index.html`. The owner commits both and may edit the
  document in any Grist. Vite copies `public/` into every build, so each
  channel serves `<channel>/demo/` next to the widget.
- **One document for every channel and host.** Grist rejects a relative
  widget URL, so the document holds a placeholder URL of fixed length; the
  page replaces it with the build beside it (`../`) before grist-static
  opens it. Same byte length keeps the SQLite file valid (tried: every
  example renders).
- **grist-static is served by gristwidgets.com, pinned** (deviation from
  "a CDN"): the package is 188 MB, over jsDelivr's size limit, and no CDN
  could be verified. The site build fetches the npm tarball, checks its
  integrity and copies `dist/` without source maps (90 MB) to
  `/grist-static/<version>/`; widgets' demo pages load it cross-origin
  (CORS via `_headers` on Cloudflare).
- **Every example has `/examples/<id>/demo/`** on the site, replacing the
  playground's ~40 "try it" links; their documents are committed
  (`examples/_demos/`, 106 KB compressed), since the Cloudflare build has no
  Docker, and CI checks they match each example's columns and access.
- **Limits:** no attachments, no import/export; changes are not saved
  (right for a demo).

### E. Security

- **Fixed (#233):** `fetchWithGristAuth()` attached the document's access
  token to any absolute URL. Now only the Grist instance's origin gets it.
- **CI habit:** the required checks (`test`, `external-install`) are
  path-filtered, so every docs-only or CLI-only PR needs the maintainer's
  bypass. A bypass used routinely stops being a safeguard. **Done:** one
  `ci.yml` whose `gate` job always runs and depends on the path-relevant
  jobs (`scripts/ci/changes.mjs`); require only `gate`.
- **Emulator iframe transport:** filters messages by shape, not by
  `event.source`. Moot once retired (D); otherwise check the source window.
- **Plugin API from docs.getgrist.com, no SRI:** accepted. It is Grist's
  documented loading method and the file changes with Grist; `pnpm demo`
  already serves it from the local Grist.
- **Already sound:** npm publishing bound to `main` (environment + trusted
  publisher, tokens disallowed); the deploy's publish job runs no
  dependency code; the registry and the site validate third-party JSON;
  the real-widget checks run read-only, without secrets.

### F. Robustness

- **Strong:** the real-widget safety net (packed SDK and CLI against the six
  reference widgets on every PR; a real Grist weekly), the smoke scripts,
  the canary, and `upgrade` with its explicit template/widget boundary.
- **Tests coupled to internals:** the handshake reducer, manager and
  property tests (~1,400 lines) pin the machinery, not the behaviour
  widgets rely on; they go with it (A) and are replaced by contract tests
  on `useGrist()`.
- **The render bench overwrites its baseline instead of checking it.**
  `results.json` is a committed baseline of render counts, but the bench
  rewrites it on every run and never compares: a render regression can't
  fail anything. **Done:** it compares and fails, rewrites only with
  `bench:update`, and runs in CI. Its first run found what the old one hid:
  the schema scenario had been failing (it read metadata with
  `"read table"`), and two scenarios had grown from 1 to 3 and 0 to 2
  renders since May. The baseline starts from today's counts; the
  synchronous runtime (A) should lower them.
- **Stale references:** about 15 code comments pointed to
  `docs/planning/2026-08-execution-plan.md`, which no longer exists. Fixed
  with this review: they point to the archived plans in `docs/history/`.

### G. CLI, template, deploy, registry: right-sized

- `upgrade` (564 lines) and `grist-widget-deploy` (584) are worth their
  size: each replaced a recurring manual chore, and both have tests.
- The template (34 files) is the shadcn/Vite baseline; nothing to cut.
- The CLI embeds 17 examples (`create --example`, `use`, `list`, plus
  `compose-example` and `build-template` vendoring). Once the core widget
  library exists, `create --example` can start from a library widget, and
  the embedded copies go. Not before.
- The registry (manifest-based, Grist-format list) is the simplest design
  that keeps data honest. Keep.
- The site's double build (GitHub Pages and Cloudflare) serves networks that
  block one or the other; keep, it costs one CI job.

## 4. Options considered

| Option | For | Against | Verdict |
| --- | --- | --- | --- |
| Keep as is, polish docs | No risk | Keeps 2x the code, the bundle cost and the bypass habit | No |
| **Slim in place** (A–D), as 0.4.0 | Same API shape for widgets; each step checked by the real-widget CI | Several PRs; one breaking release | **Recommended** |
| New library from scratch | Clean slate | Loses tested assets; same destination as slimming, with more risk | No |
| Drop React, ship a framework-free core | Smaller | Every widget is React; the template, tests and docs are React | No |

## 5. Decisions (taken 2026-11-09)

1. Slim in place as **0.4.0** (A–C), breaking the unused surface: **yes**.
2. Retire the **playground**, iframe transport and devtools (D): **yes**,
   with demos on grist-static.
3. One CI **gate** as the only required check (E): **yes**.
4. Slimming **before** the core widget library: **yes**.
5. Typed reads from the declared types and `cellFormat: "typed"`, with
   Standard Schema for extra rules and no `zod` in the SDK (C): **yes**.
6. `demo.grist` generated by the CLI and owned by the widget; grist-static
   from a pinned CDN (D): **yes**.

## 6. Test strategy

The goal is a project that stays working, not a coverage number. Tests earn
their place by catching a failure a widget would hit.

| Layer | Keeps the project working by | Keep / change |
| --- | --- | --- |
| `useGrist()` contract tests (emulator) | Pinning what widgets rely on: states, records, mapping, writes, options, alerts | **Grow**: replace the handshake internals tests (A) |
| `smokeTestWidget()` in every widget | Catching an SDK release that breaks a widget before its Dependabot PR merges | Keep |
| Real widgets on every SDK PR (packed builds) | Catching a regression in real code before release | Keep |
| Real Grist, weekly (pinned image) | Catching emulator drift and Grist changes | Keep; it is the parity check (replaces task-013) |
| CLI tests (`upgrade`, `manifest`, `deploy`, `demo`) | Guarding the commands that rewrite or publish widget repos | Keep |
| Smoke scripts (scaffold, external install, deploy) | Testing the published shape, not the workspace | Keep |
| Registry build tests | Guarding what the registry lists | Keep |
| Bench (render budget) | Catching render-count regressions | Compare against `results.json` and fail; rewrite only on an explicit update |
| Tests of unused layers | — | Delete with the layers |

Two additions with clear value: a **size budget** on the template build (C),
and a **contract test per public `useGrist()` member** generated from the
public-API list, so a member can't exist without a test.
