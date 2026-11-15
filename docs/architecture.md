# Architecture

How the pieces of this repository fit together, and the rules that keep
them that way. Read it before changing a public API, adding a package, or
moving code between packages. The decisions behind it are in
[`docs/decisions/`](./decisions/); the procedures are in
[`docs/operations/`](./operations/).

## The pieces

```text
packages/core/                  grist-widget-sdk (npm): the SDK, the app chrome, the emulator
packages/create-grist-widget/   create-grist-widget (npm): scaffold, upgrade, demo, release, protect, deploy
templates/grist-widget-template-vite/   the template the CLI embeds and scaffolds
examples/                       16 example widgets (each a widget's src/app/), built by the site
apps/www/                       the docs and landing site (Next.js + fumadocs, static export)
scripts/                        the site build, CI helpers, real-widget checks, smoke tests
docs/                           this file, decisions, operations, plans
```

The two npm packages always carry the same version
([ADR 0004](./decisions/0004-release-train.md)).

## A widget at run time

```text
Grist document
  → the widget's iframe (its own static page)
    → grist-plugin-api.js (the `grist` global, Grist's RPC channel)
      → grist-widget-sdk: GristWidgetProvider → one runtime store
        → useGrist() / widget.useGrist() in the widget's components
```

- **`mountGristWidget(entry)`** (`grist-widget-sdk/app`) is a widget's
  whole `src/main.tsx`.
  - **Inside Grist,** it renders `GristWidgetProvider`, which holds the
    connection from the widget's declaration, and `GristBoundary`, which
    shows the connecting, access and column-mapping screens. Around them
    come the SDK's alerts and Grist's light and dark theme.
  - **Outside Grist,** it shows the local-dev page or the release page.
- **`defineGristWidget({ requiredAccess, columns, … })`** is the widget's
  one declaration. `widget.useGrist()` is `useGrist()` typed from it.
  `useGrist()` throws outside a provider; `useGristOptional()` returns
  `null` there.
- **The runtime** (`packages/core/src/sdk/runtime/`) is one store per
  provider, read through `useSyncExternalStore`, so a component re-renders
  only when a value it reads changes:
  - `ready.ts` calls `grist.ready` once;
  - `host.ts` holds the subscriptions;
  - `derive.ts` computes mapped and typed values;
  - `api.ts` holds the reads and writes on the result.
- **Writes** go through two paths only:
  - the table operations: `w.updateRecord`, `w.addRecord`, `w.table.*` and
    `w.getTable(id).*`;
  - `w.applyActions([...])`, with builders from `grist-widget-sdk/actions`.

  `mapBack` encodes each value for its declared type before it reaches
  Grist.
- **The emulator** (`grist-widget-sdk/emulator`, and `/emulator/testing`
  for tests) implements the same `grist` global in memory.
  `renderWithGrist(<App />, { widget, rows })` renders a widget against its
  declared columns, mapped, with typed rows. The emulator follows Grist,
  not the other way round: a widget that passes in the emulator and fails
  in a real Grist points at a gap in the emulator
  ([real widgets](./operations/real-widgets.md)).
- **The replica document** is the one JSON shape for a snapshot of a Grist
  document: its tables, columns, and optionally rows. `useGristSchema()`
  produces it, the emulator takes it, and tests use it as fixtures. Its
  user-facing description is the site's *Replica document* page.

## The CLI and the template

- `npm create grist-widget <name>` scaffolds from the embedded template
  (`packages/create-grist-widget/scripts/build-template.mjs` embeds
  `templates/grist-widget-template-vite/` at build time).
- **`upgrade`** rewrites only the template's own files in a widget
  (`TEMPLATE_FILES` in `src/upgrade.mjs`). Its codemods rewrite renamed
  SDK names and list what they can't rewrite safely.
- **`grist-widget-deploy`** is the deploy that a widget's
  `.github/workflows/deploy.yml` runs. It publishes three channels to the
  widget's `gh-pages` branch: `dev` on every push to `dev`, and on every
  release an immutable `v<version>` and a moving `latest`. Its first
  release also checks the repository's protection.
- `demo`, `release` and `protect` are commands for the widget's owner.
- **Widgets render only inside a real Grist**: in the browser through
  grist-static, in Docker, or a live document. There is no seeded local
  preview ([ADR 0002](./decisions/0002-real-grist-only.md)).

## The site

`scripts/build-site.mjs` assembles one static tree for two independent
origins, GitHub Pages and Cloudflare Pages
([ADR 0001](./decisions/0001-two-site-origins.md),
[site deploy](./operations/site-deploy.md)). It contains:
- the docs, from `apps/www`;
- each example at `/examples/<id>/latest/`, with its demo page;
- grist-static.

`apps/www` does not depend on `grist-widget-sdk`, so an SDK change cannot
break the docs deploy.

## The registry and the reference widgets

The catalog of widgets is
[awesome-grist-widgets](https://github.com/ArthurBlanchon/awesome-grist-widgets).
`widgets.json` is generated from each widget's published
`grist-widget.json`; its entries marked `"reference": true`, plus
`scripts/real-widgets/pending.json`, are the reference widgets. The Real
widgets job checks every SDK pull request against them
([real widgets](./operations/real-widgets.md)).

The [widget factory plan](./planning/2026-11-14-widget-factory-plan.md)
brings the catalog into this repository (`widgets/<slug>/`, one `SPEC.md`
each, the shared shadcn UI in `widgets/_shared/`).

## Design rules

These decide whether a change to the public surface is accepted. A request
that breaks one changes, or, rarely, the rule does, through a new decision
record.

1. **One object.** A widget reads Grist through `useGrist()`, or
   `widget.useGrist()`, and nothing else. Every feature answers: how does it
   look from `useGrist()`? No plugin registries, no extra providers.
2. **No `grist` global in widget code.** The SDK calls `grist.ready` once and
   owns every subscription. Tests stay deterministic, several component
   trees can coexist, and a change in Grist's RPC is one file.
3. **Decoded by default.** Reads return JavaScript values: `Date`, reference
   objects, error objects. Only the columnar readers (`fetchRows(…, {
   columnar: true })`) return Grist's wire values, because that is their
   contract.
4. **One `mode`, not several flags.** `"empty" | "row" | "new-row"`; a new
   state extends `mode` before it adds a flag.
5. **Two write paths, and only two** (above). A higher-level pattern, such as
   a form binding, lives in widget code.
6. **A small surface.** Each `useGrist()` member is pinned by a contract test
   (`packages/core/tests/contract/`). The root entry's names are listed in
   `packages/core/tests/sdk/public-api.test.ts`. A new member or export
   earns its place in a real widget first. The API report
   (`packages/core/api/`) shows every change in review.
7. **Mapping is first-class.** Every read that gives logical names has a
   write that maps them back. Every error about a missing mapping names the
   columns.
8. **Tests look like production.** There is no mock mode. Tests run the real
   subscription paths through the emulator, and a hook that behaves
   differently in tests is a bug.
9. **Types are API.** A type-only change is an API change, versioned like
   behaviour ([versioning policy](https://gristwidgets.com/docs/sdk/api/versioning)).
10. **One package, a few entry points:** `grist-widget-sdk`, `/app`,
    `/actions`, `/emulator`, `/emulator/testing`, and the TypeScript
    configurations `/tsconfig/app.json` and `/tsconfig/node.json`. A
    widget's runtime path has no validation library: extra rules come
    through Standard Schema, from the library the widget already uses.
11. **Errors are visible.** Connection, action and mapping errors are plain
    strings on `useGrist()`, never thrown silently or only logged.
    `GristBoundary` and the alerts show them with no widget code.
12. **Docs ship with behaviour.** A change to behaviour without its docs, or
    a feature without docs, is incomplete.

### Conventions

- **Names:**
  - hooks are `useGrist…`, components `Grist…`, types `Grist…`, and hook
    results `UseGrist…Result`;
  - action builders are `grist<Verb>…Action`;
  - helpers are verbs naming their domain (`decodeGristValue`,
    `extractGristAttachmentIdsFromCell`).
- **Defaults are the safe value.** `requiredAccess` defaults to
  `"read table"`, and `options.readOnly` asks for a read-only token on the
  REST and attachment helpers.
- **No value has three meanings.**
  - `null` means not known yet;
  - `[]` means an empty result;
  - `undefined` is only ever accepted on input options, never returned.

  So `mappedRecord == null` means a mapping is missing, and
  `records == []` means the section has no rows.
- **Async versus sync.** Anything that talks to Grist returns a `Promise`;
  React state and the action builders are synchronous.

### What the SDK does not do

- It does not guess column types: the user maps logical names to columns.
- It does not style a widget's own content. It styles only the chrome
  around it (`GristBoundary`'s screens, the alerts, the outside-Grist
  pages), which reads shadcn's CSS variables, so it follows the widget's
  theme.
- It does not support frameworks other than React. Use
  `grist-plugin-api.js` directly.
- It does not work around missing Grist features. A missing method throws,
  and the error shows.
