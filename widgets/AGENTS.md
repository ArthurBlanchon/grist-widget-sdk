# Agent guide: the catalog widgets (`widgets/`)

The widget factory's catalog ([ADR 0007](../docs/decisions/0007-widget-factory.md),
[plan](../docs/history/2026-11-14-widget-factory-plan.md),
[first list](../catalog/roadmap.md)). Each `widgets/<slug>/` is one widget,
a private workspace package; `widgets/_shared/` is what they all share.

## A widget's folder

| Path | What |
| --- | --- |
| `CHANGELOG.md` | What changed in each version, for the people using it; newest first, the declared version on top. Each release carries it |
| `SPEC.md` | The source of truth: front matter (`slug`, `title`, `category`, `status`, `access`), then Job, Columns, Access, Acceptance criteria (`**AC-n**`), Out of scope, Demo data |
| `src/app/App.tsx` | The `widget` declaration (`defineGristWidget`) and the default export `App` |
| `src/app/messages.ts` | Its English and French text (`defineMessages`) |
| `src/app/*.test.tsx` | One test per criterion, named `it("AC-n …")`; `App.smoke.test.tsx` mounts it as Grist does |
| `src/main.tsx` | `mountGristWidget(entry)` and the shared theme, the same in every widget |
| `package.json` | `@grist-widgets/<slug>`, private, MIT; versions are `catalog:` (`pnpm-workspace.yaml`) |
| `vite.config.ts`, `eslint.config.js`, `tsconfig.json` | One line each onto `widgets/_shared/` |

Start a new widget with `pnpm new-widget <slug>`, then write its `SPEC.md`
before its code, reading the core widget closest to it (the Kanban board is
the first).

## Rules

- **The spec comes first, and stays true.** A change in behaviour changes
  `SPEC.md` and its tests in the same pull request.
- **Every criterion has a test,** named `it("AC-n …")`, using
  `renderWithGrist(<App />, { widget, rows })`.
- **UI from `@shared/ui/*` only** (the shadcn components, one copy). A
  missing component is added once, to `widgets/_shared/`, with
  `pnpm dlx shadcn add <name>` run there.
- **No colour, pixel size or arbitrary Tailwind value** in a widget's code:
  the theme (`@shared/theme.css`) holds them. Third-party views take their
  colours from the theme's CSS variables.
- **English and French,** through `useT(messages)`. A key missing from
  either dictionary fails the typecheck.
- **The lowest access that works;** `full` only to write, and said in the
  spec's Access section.
- **Data is never rendered as HTML.** No `dangerouslySetInnerHTML` or
  `eval`, and links from data are http(s) only.
- **No API key in widget options** ([ADR 0010](../docs/decisions/0010-api-keys.md)).
- **Dependencies are `catalog:` versions.** A dependency only one widget
  needs goes in its own `package.json`, under a licence on the allow list
  (MIT, BSD, Apache-2.0, ISC).

## Releasing

Raise the widget's `version` in its `package.json` in the pull request that
changes it, and add its entry on top of the widget's `CHANGELOG.md`
(`## x.y.z (date)`, then what changed for the people using it; the check
fails without it). Follow semver from the person's side:
- a fix is a patch;
- a new option or behaviour is a minor;
- a column, access or behaviour change that breaks a document already
  using it is a major.

On the merge, the release job builds that version once into the
`widgets-dist` branch, and both origins serve it at
`/widgets/<slug>/<version>/` and `/latest/`
([site deploy](../docs/operations/site-deploy.md)). A change merged without a
new version publishes nothing, and a released version is never rebuilt.

## Commands

Run these from the repository root.

| Intent | Command |
| --- | --- |
| Start a widget (pnpm new-widget does the same) | `node scripts/widgets/new-widget.mjs <slug>` |
| Check every widget's spec, criteria, declaration and design rules (pnpm check:widgets does the same) | `node scripts/widgets/check-widgets.mjs` |
| Test one widget | `pnpm --filter @grist-widgets/kanban-board test` |
| Type-check it | `pnpm --filter @grist-widgets/kanban-board typecheck` |
| Lint it | `pnpm --filter @grist-widgets/kanban-board lint` |
| Build it | `pnpm --filter @grist-widgets/kanban-board build` |
| Test the shared package | `pnpm --filter @grist-widgets/shared test` |

For every widget at once, as CI runs it:
`pnpm --filter "./widgets/**" -r --workspace-concurrency=1 run <script>`.
After a build, `node scripts/widgets/check-widgets.mjs --sizes` checks each
bundle against its budget (`bundle-kb` in the spec, 125 KB gzipped by
default). In a real Grist (Docker), with axe and a dark screenshot:
`pnpm e2e:grist widgets/<slug> --build --axe --themes`.

## Path map

| Concept | Path |
| --- | --- |
| The pilot widget | `kanban-board/` |
| Shared shadcn components | `_shared/ui/` |
| Shared components from other shadcn registries (kibo-ui's Gantt) | `_shared/kibo-ui/` |
| Typed fields from a column's Grist type (Record editor, Bulk editor) | `_shared/grist-fields.ts` |
| A cell as text, in the person's language (Document template, Mail merge) | `_shared/cell-text.ts` |
| The theme | `_shared/theme.css` |
| Translations | `_shared/i18n.ts` |
| Vite and Vitest configuration | `_shared/vite.ts` |
| ESLint configuration | `_shared/eslint.config.js` |
| shadcn configuration | `_shared/components.json` |
| The checker | `../scripts/widgets/check-widgets.mjs` |
| The generator | `../scripts/widgets/new-widget.mjs` |
| The real-Grist check | `../scripts/real-widgets/e2e-grist.mjs` |
