# Agent guide: the catalog widgets (`widgets/`)

The widget factory's catalog ([ADR 0007](../docs/decisions/0007-widget-factory.md),
[plan](../docs/planning/2026-11-14-widget-factory-plan.md),
[first list](../catalog/roadmap.md)). Each `widgets/<slug>/` is one widget,
a private workspace package; `widgets/_shared/` is what they all share.

## A widget's folder

| Path | What |
| --- | --- |
| `SPEC.md` | The source of truth: front matter (`slug`, `title`, `category`, `status`, `access`), then Job, Columns, Access, Acceptance criteria (`**AC-n**`), Out of scope, Demo data |
| `src/app/App.tsx` | The `widget` declaration (`defineGristWidget`) and the default export `App` |
| `src/app/messages.ts` | Its English and French text (`defineMessages`) |
| `src/app/*.test.tsx` | One test per criterion, named `it("AC-n …")`; `App.smoke.test.tsx` mounts it as Grist does |
| `src/main.tsx` | `mountGristWidget(entry)` and the shared theme, the same in every widget |
| `package.json` | `@grist-widgets/<slug>`, private, MIT; versions are `catalog:` (`pnpm-workspace.yaml`) |
| `vite.config.ts`, `eslint.config.js`, `tsconfig.json` | One line each onto `widgets/_shared/` |

Start a new widget from the core widget closest to it (the Kanban board is
the first), its `SPEC.md` written before its code.

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

## Commands

Run these from the repository root.

| Intent | Command |
| --- | --- |
| Check every widget's spec, criteria, declaration and design rules | `node scripts/widgets/check-widgets.mjs` |
| Test one widget | `pnpm --filter @grist-widgets/kanban-board test` |
| Type-check it | `pnpm --filter @grist-widgets/kanban-board typecheck` |
| Lint it | `pnpm --filter @grist-widgets/kanban-board lint` |
| Build it | `pnpm --filter @grist-widgets/kanban-board build` |
| Test the shared package | `pnpm --filter @grist-widgets/shared test` |

For every widget at once, as CI runs it:
`pnpm --filter "./widgets/**" -r --workspace-concurrency=1 run <script>`.

## Path map

| Concept | Path |
| --- | --- |
| The pilot widget | `kanban-board/` |
| Shared shadcn components | `_shared/ui/` |
| The theme | `_shared/theme.css` |
| Translations | `_shared/i18n.ts` |
| Vite and Vitest configuration | `_shared/vite.ts` |
| ESLint configuration | `_shared/eslint.config.js` |
| shadcn configuration | `_shared/components.json` |
| The checker | `../scripts/widgets/check-widgets.mjs` |
