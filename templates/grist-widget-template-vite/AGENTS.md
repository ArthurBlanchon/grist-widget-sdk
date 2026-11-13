# Agent guide — start here

> Audience: an agent working inside a widget repo scaffolded from
> `create-grist-widget` (this file travels with the scaffold), or working on
> this template's own source under
> `templates/grist-widget-template-vite/` inside the `grist-widget-sdk`
> monorepo. This repo is a **distribution artifact** — `main` is force-pushed
> from a fresh scaffold on every release, not developed on directly upstream.
> If you're in the monorepo working on the SDK itself, read the root
> `AGENTS.md` instead.

## The widget contract

The widget lives in `src/app/`. Its entry point, `src/app/App.tsx`, exports its declaration
and the widget:

```tsx
export const widget = defineGristWidget({
  title: "...",
  description: "...",
  requiredAccess: "read table",
  columns: [{ name: "Title", type: "Text" }],
})

export default function App() {
  const w = widget.useGrist() // typed from the declaration: no generics
  // w.mappedRecord, w.updateRecord({ Title: "..." }), ...
}
```

The declaration may live in a file of its own (`src/app/widget.ts`), as long as `App.tsx`
re-exports it. A widget made before `defineGristWidget` exports `GRIST_OPTIONS` and
`WIDGET_METADATA` instead; both forms work.

`src/main.tsx` is one call, `mountGristWidget(entry, { dev })` from `grist-widget-sdk/app`,
with `entry` the module `src/app/App.tsx`: inside Grist it renders the widget in
`GristWidgetProvider` and `GristBoundary`, with the SDK's alerts and Grist's light/dark
theme. To replace the alerts or the pages shown outside Grist, export `Alerts`,
`LocalDevPage` or `ReleasePage` from `src/app/App.tsx`; a provider goes inside `App`. Never
edit `src/main.tsx`: `upgrade` refuses to run over a changed one. Access level, column
mapping, and rendering all live in `src/app/App.tsx`: that's the file to edit.

### What is the template's, what is the widget's

- **The template's:** `src/main.tsx`, `src/components/theme-provider.tsx`,
  `src/lib/utils.ts`, `src/vite-env.d.ts`, the workflows and Dependabot config,
  `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, the Prettier config,
  `CLAUDE.md` and this file.
  Leave them as they are: `pnpm exec create-grist-widget upgrade` rewrites them to the
  template of the `create-grist-widget` version the widget depends on
  (<https://gristwidgets.com/docs/cli/upgrading>), and a local edit would be lost.
- **The widget's:** everything else. `src/app/` holds its code and tests, the smoke test
  included: put every new component, hook, helper and asset there. `src/components/ui/`
  holds the shadcn primitives, where `shadcn add` writes (next to any other registry
  folder it installs), `src/index.css` the theme, and `components.json` shadcn's
  configuration, registries included. `tsconfig.app.json` and
  `tsconfig.node.json` keep the widget's own paths and types (their compiler settings come
  from `grist-widget-sdk`). `README.md`, `index.html`, `public/` and
  `pnpm-workspace.yaml` are the widget's too, and so is `package.json`, apart from the
  scripts and dependency versions the template sets.

## Operating contract

1. **Widgets use the SDK.** No direct `window.grist.*` calls — use `useGrist()` and the
   other `grist-widget-sdk` hooks.
2. **The widget only renders inside real Grist, never in a seeded preview.** Opened
   outside Grist, `pnpm dev` shows the SDK's local-dev page: an emulator can't guarantee
   parity with real Grist, so a fake preview would teach the wrong lesson. Real Grist comes
   three ways, none of them a preview:
   - **`pnpm dev`, then `http://localhost:5173/demo/index.html`:** the demo page,
     `public/demo/` (Grist itself, running in the browser from static files), on the dev
     server's widget, so edits reload in place. No Docker. After changing the declared
     columns, regenerate its document with `pnpm demo --save`.
   - **`pnpm demo`:** a real Grist in Docker (pinned image) with a generated document.
   - **The `dev` branch's `/dev/`** in a Grist document of the owner's: the check that counts.

   Trust `pnpm test` (headless, real assertions) for fast local feedback. Don't build or
   suggest a seeded `pnpm dev` preview.
3. **Widget changes get a test.** `src/app/App.test.tsx` uses
   `renderWithGrist(<App />, { widget, rows })` from `grist-widget-sdk/emulator/testing`: the
   widget against its declared columns, mapped, with typed rows; no browser or real Grist doc
   needed. Run `pnpm test`.
4. **Always develop on `dev`, release by merging to `main`.** Commit and push to `dev` for
   every change — it auto-deploys a live preview at `.../dev/` that self-reloads inside an
   open Grist document a few seconds later. Bump `package.json`'s `version` *before*
   opening the `dev` → `main` PR: merging without a version bump publishes nothing (the
   release build silently no-ops whenever that version's directory already exists — the PR
   merges cleanly and CI reports success either way).
5. **Template updates arrive with `create-grist-widget`.** Dependabot opens a pull request of
   its own for it. Once that is merged into `dev`, run `pnpm exec create-grist-widget upgrade`
   on `dev` in a follow-up pull request, then `pnpm install`, `pnpm typecheck`, `pnpm lint` and
   `pnpm test`. It rewrites the template's files (listed above) and, in the widget's code, the
   `grist-widget-sdk` names a release deprecated, and says what it changed and what is left
   to change by hand.

## Commands

| Intent | Command |
| --- | --- |
| Install | `pnpm install` |
| Dev server; `/demo/index.html` opens the widget in real Grist in the browser, edits reloading in place | `pnpm dev` |
| The widget in a real local Grist (Docker; prints the URL, Ctrl-C stops it) | `pnpm demo` |
| The widget's demo page in `public/demo/` (Docker to generate; served at `<channel>/demo/`) | `pnpm demo --save` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Type-check | `pnpm typecheck` |
| Preview a production build | `pnpm preview` |
| Bring the template's files up to date (on `dev`, after updating create-grist-widget) | `pnpm exec create-grist-widget upgrade` |

## Path map

| Concept | Path |
| --- | --- |
| The widget (everything in it is the widget's own) | `src/app/` |
| Its entry point (the `export const widget` declaration, the default export App) | `src/app/App.tsx` |
| Widget test (the pattern to copy for new tests) | `src/app/App.test.tsx` |
| Smoke test (one smokeTestWidget call; CI runs it on SDK updates) | `src/app/App.smoke.test.tsx` |
| Grist wiring (mountGristWidget(entry), inside vs. outside Grist; never edited) | `src/main.tsx` |
| ui primitives | `src/components/ui/` |
| Deploy workflow (runs grist-widget-deploy from the create-grist-widget devDependency: version guard, channel logic) | `.github/workflows/deploy.yml` |
| Pull request checks (lint, test, build) | `.github/workflows/ci.yml` |
| Dependency update PRs (weekly, against the dev branch) | `.github/dependabot.yml` |
| Full walkthrough (dev loop, deploying, embedding) | `README.md` |
| Changelog | `CHANGELOG.md` |

## One-time repo settings

Only needed once, after the first push triggers the deploy workflow's first run (it
creates a `gh-pages` branch — these settings can't be applied before that exists):

1. Settings → Pages → Source → **Deploy from a branch** → branch `gh-pages`, folder
   `/ (root)`. Not `main` — pointing Pages at `main` serves this repo's raw, unbuilt source
   instead of the built site (symptom: a blank page with a `/src/main.tsx` 404).
2. If that first workflow run fails with a permissions error pushing to `gh-pages`:
   Settings → Actions → General → Workflow permissions → **Read and write permissions**.
   Most repos don't need this; it depends on account/org defaults.
3. After the first release (which commits to `main` and resets `dev`), a branch ruleset:
   `main` requires a pull request and the `check` status, and blocks force pushes and
   deletion; `dev` blocks force pushes and deletion. An agent acts through the owner's
   account, so these rules don't tell it apart: they keep red changes off `main` whoever
   merges. Ask the owner to set them; they need admin access.

Full detail, including the two live URLs (`/latest/` and `/v<version>/`): `README.md`.

## Anti-patterns

- Calling `window.grist.*` inside widget code instead of the SDK's hooks
- Building or describing a seeded/live `pnpm dev` preview — deliberately not how this
  template works (see above); `pnpm test` is the trusted local loop, real Grist via `/dev/`
  is the trusted real one
- Merging `dev` into `main` without bumping `package.json`'s `version` first
- Adding widget code outside `src/app/`, or editing the template's files to change the
  widget (see the widget contract above)
- Adding `minimumReleaseAgeExclude` entries to `pnpm-workspace.yaml` to get an install or a
  check green, or deleting the ones pnpm wrote for `grist-widget-sdk` and `create-grist-widget` on release day (see
  `README.md`): pnpm's 24 h age check protects the widget's supply chain
- Merging a Dependabot pull request whose `ci.yml` checks are red, or retargeting one at
  `main`: updates go through `dev` like any other change, template-file updates
  (`pnpm exec create-grist-widget upgrade`) included —
  <https://gristwidgets.com/docs/cli/upgrading>
