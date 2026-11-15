# Agent guide: `create-grist-widget` (`packages/create-grist-widget`)

The CLI (`create`, `upgrade`, `demo`, `release`, `protect`) and
`grist-widget-deploy`, the deploy that every widget's workflow runs. The
template it scaffolds is `templates/grist-widget-template-vite/`, embedded
at build time (`scripts/build-template.mjs`).

## Rules

- **Try a template or CLI change on a real widget before its pull request
  merges.**
  - The reference widgets hold what unit tests don't foresee: shadcn
    registries in `components.json`, providers or `lazy()` around `App`,
    mocks in the smoke test.
  - On a copy of one, run the changed `upgrade` (or scaffold), then
    `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` and
    `pnpm e2e:grist <dir>`.
  - The Real widgets job repeats the typecheck, test and build on every
    pull request touching `packages/`.
- **Before `upgrade` rewrites an older widget's `src/main.tsx`,** compare it
  with the template's, and move what is the widget's own (a provider, a
  `lazy()`) into `src/app/App.tsx` first.
- **The template's files** are `TEMPLATE_FILES` in `src/upgrade.mjs`. The
  Upgrading docs page lists them, and a test keeps the two in step. A
  widget's own files are never rewritten, apart from the renamed SDK names
  the codemods change (`src/codemods.mjs`).
- **`grist-widget-deploy` imports Node built-ins only.** It runs in widgets'
  CI before their dependencies matter, and a test pins its imports.
- **A template change's changeset says what an existing widget has to
  do**, if anything ("Existing widgets can …"). Scaffolded repositories
  never receive template files again except through `upgrade`.
- **Run `scripts/smoke/*` one at a time** locally: they share
  `packages/core/dist`, and one rebuilds it under the other.

## Commands

| Intent | Command |
| --- | --- |
| Build (embeds the template) | `pnpm --filter create-grist-widget build` |
| Test | `pnpm --filter create-grist-widget test` |
| Lint | `pnpm --filter create-grist-widget lint` |

## Path map

| Concept | Path |
| --- | --- |
| The CLI | `bin/create-grist-widget.mjs` |
| The deploy | `bin/grist-widget-deploy.mjs`, `src/deploy.mjs` |
| upgrade, and the template's file list | `src/upgrade.mjs` |
| Codemods for renamed SDK names | `src/codemods.mjs` |
| release, protect | `src/release.mjs`, `src/protect.mjs` |
| demo (local Grist, demo page) | `src/demo.mjs`, `src/grist-local.mjs`, `src/demo-page.mjs` |
| Template embedding | `scripts/build-template.mjs` |
| The template's source | `../../templates/grist-widget-template-vite/` |
| Tests | `tests/` |
| Changelog (generated) | `CHANGELOG.md` |
