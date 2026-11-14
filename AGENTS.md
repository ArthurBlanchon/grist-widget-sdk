# Agent guide — start here

> Audience: AI agents and new contributors working in this repository.
> Read this once per session. For what to build next: [`TODO.md`](./TODO.md)
> is the one ordered list of work left, and [`docs/planning/`](./docs/planning/)
> holds the review or plan it comes from. Finished plans and the old
> backlog are in [`docs/history/`](./docs/history/).

**Scope for the current task is agreed in chat** with the maintainer — there is
no required spec file.

## Operating contract

1. **Follow [`TODO.md`](./TODO.md).** Take items in order; an item done
   leaves the file in the same PR.
2. **Public exports only.** Use the `grist-widget-sdk` and
   `grist-widget-sdk/emulator` entry points — never `grist-widget-sdk/src/…`.
3. **Widgets use the SDK.** No direct `window.grist.*` in widget code.
4. **Docs ship with behaviour.** Public API or contract changes update the
   matching page under `apps/www/content/docs/` in the same change set.
5. **Changelog.** User-visible changes get a changeset: run `pnpm changeset`
   and commit the generated `.changeset/*.md` file — it becomes the
   published `CHANGELOG.md` entry for `packages/core` or
   `packages/create-grist-widget` on release. A template change's
   changeset also says what an existing widget has to do, if anything
   ("Existing widgets can …"): scaffolded repos never receive template
   files again, and the
   [Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading) page
   sends their owners to these entries.

## Commands

| Intent | Command |
| --- | --- |
| Install everything | `pnpm install` |
| Build the SDK | `pnpm --filter grist-widget-sdk build` |
| Test the SDK | `pnpm --filter grist-widget-sdk test` |
| Full suite (SDK + example typecheck + site) | `pnpm test` |
| Type-check the SDK | `pnpm --filter grist-widget-sdk exec tsc --noEmit` |
| Regenerate the SDK's API report (after `build`; commit `packages/core/api/`) | `pnpm --filter grist-widget-sdk api:report` |
| Site dev / build | `pnpm --filter www dev` / `pnpm build:www` |
| Regenerate the examples' demo documents (Docker) | `node scripts/example-demos.mjs build` |
| Scaffold a new widget repo | `npm create grist-widget <name>` |
| Regenerate the widget catalog | `pnpm build:widgets-manifest` → `widgets.json` |
| Check widgets in a real Grist (Docker) | `pnpm e2e:grist <widget dir>` |

## Path map

| Concept | Path |
| --- | --- |
| Work left, in order | `TODO.md` |
| Active review or plan | `docs/planning/` |
| Finished plans, old backlog | `docs/history/` |
| Changelog | `pnpm changeset` → `packages/core/CHANGELOG.md` / `packages/create-grist-widget/CHANGELOG.md` |
| SDK source | `packages/core/src/sdk/` |
| SDK tests | `packages/core/tests/` |
| Scaffolding CLI | `packages/create-grist-widget/` |
| Docs + landing site | `apps/www/` (content in `apps/www/content/docs/`) |
| Widget examples (source of truth) | `examples/hello-world/` (16 dirs total, each holding a WidgetApp.tsx) |
| Examples' host (Vite config, shared ui, demo documents) | `examples/_ui/`, `examples/_demos/` |
| Starter template | `templates/grist-widget-template-vite/` |
| Widget catalog (generated — `pnpm build:widgets-manifest`) | `widgets.json` |
| Real-widget checks: the widget list and its scripts | `scripts/real-widgets/` |

## Decision tree

| Task type | Read next |
| --- | --- |
| What to build next | `TODO.md`, and the `docs/planning/` document it cites |
| SDK public API | `packages/core/src/sdk/index.ts`, [Design principles](https://gristwidgets.com/docs/sdk/design/principles) |
| Testing widgets | [Testing](https://gristwidgets.com/docs/emulator/testing), [Emulator](https://gristwidgets.com/docs/emulator/api) |
| Deploy / CI | [Deploy notes](https://gristwidgets.com/docs/contributing/deploy) |
| Releasing to npm | [Releasing](https://gristwidgets.com/docs/contributing/releasing), `RELEASING.md` |

## Anti-patterns

- Importing from `grist-widget-sdk/src/…`
- Calling `window.grist.*` inside widget code
- Shipping public API changes without doc updates
- Skipping the changeset for user-visible changes (touching
  `packages/core/src`, `packages/create-grist-widget/{src,scripts}`, or the
  template without one fails CI — `scripts/check-changeset.sh`)
- Hand-editing `CHANGELOG.md` directly — changesets own it
- Pasting widget source into docs by hand — `examples/` is the canonical
  copy, and hand-copies drift silently

## Changing the template or the CLI

Standing rules, from what the
[widget life-cycle plan](./docs/history/2026-11-01-widget-lifecycle-plan.md)
taught:

- **Try it on a real widget before its PR merges.** The reference widgets
  (awesome-grist-widgets entries marked `"reference": true`, plus
  `scripts/real-widgets/pending.json`) hold what unit tests don't foresee:
  shadcn registries in `components.json`, providers or `lazy()` around
  `App`, mocks in the smoke test. On a copy of one, run the changed
  `upgrade` (or scaffold), then `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  `pnpm build` and `pnpm e2e:grist <dir>`. The Real widgets workflow repeats
  the typecheck, test and build on every PR touching `packages/`.
- **Before `upgrade` rewrites an older widget's `src/main.tsx`,** compare it
  with the template's and move what is the widget's (a provider, a `lazy()`)
  into `src/app/App.tsx` first.
- **Run `scripts/smoke/*` one at a time locally:** they share
  `packages/core/dist`, and one rebuilds it under the other.

## Hand-off checklist

- [ ] `pnpm --filter grist-widget-sdk test` green
- [ ] `tsc --noEmit` + `build` green
- [ ] `api:report` regenerated and committed if the public API changed
  ([versioning policy](https://gristwidgets.com/docs/sdk/api/versioning))
- [ ] `pnpm --filter www build` when docs changed
- [ ] `TODO.md` updated: the item done removed, any new one added
- [ ] `pnpm changeset` run and committed if user-visible

## Machine-readable docs

The docs site publishes agent-friendly formats: `/llms.txt` (index),
`/llms-full.txt` (full corpus), and per-page markdown at
`/llms.mdx/docs/<path>/content.md`. Prefer these over scraping the HTML.
