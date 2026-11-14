# create-grist-widget

## 0.6.2

### Patch Changes

- aa85ea6: The template's tests run on jsdom 31 (was 30), which needs Node.js 22.22.2 or later on the 22 line, or 24.15 or later; `create-grist-widget` now asks for the same.
  
  Existing widgets can stay on jsdom 30. To move to 31, run `pnpm add -D jsdom@^31` once it is a day old; if tests then fail at startup with `flushCharacters is not a function`, run `pnpm dedupe` so that parse5 resolves to one 8.1 copy.
- 3bf0bfb: The template's routine dependencies move up a minor or patch: Vite 8.3.6, Tailwind CSS 4.3.5, lucide-react 1.70.
  
  Existing widgets get the same updates from their own Dependabot pull requests; nothing to do by hand.

## 0.6.1

### Patch Changes

- 71785f8: **Hardened workflows and commands.** The template's workflows pin every GitHub Action to a commit SHA (with the version in a comment, which Dependabot keeps up to date) instead of a movable tag, and the pull request check no longer leaves the repository token in `.git/config`. On Windows, where package managers start through a shell, the CLI now refuses to pass anything but a plain word (a package name, a flag) as an argument, and `upgrade` only looks up `minimumReleaseAgeExclude` entries that are npm package names.
  
  Existing widgets can run `pnpm exec create-grist-widget upgrade` (after updating `create-grist-widget`) to get the pinned workflows.

## 0.6.0

### Minor Changes

- a66b203: **`upgrade` rewrites the deprecated `grist-widget-sdk` names in a widget's code.** Once the template depends on `grist-widget-sdk` 0.6, `pnpm exec create-grist-widget upgrade` also migrates the widget's own files under `src/` (not the template's, not comments), where the replacement means the same:
  
  - `useGristContext()` → `useGrist()`;
  - `w.isReady` → `w.status === "ready"` (and `!w.isReady` → `w.status !== "ready"`);
  - `fetchTableRows(…)` → `fetchRows(…)`, `fetchSelectedTable()` → `fetchRows({ columnar: true })`, `fetchTable(id)` → `fetchRows(id, { columnar: true })`;
  - the user-action builders' imports → `grist-widget-sdk/actions`.
  
  What it can't rewrite safely (`isAvailable`, a destructured flag, a reader called with options) it lists by file and line. Every rewrite is idempotent, and only runs in a file that imports `grist-widget-sdk`. https://gristwidgets.com/docs/cli/upgrading#deprecated-sdk-names
  
  Existing widgets can run `upgrade` as usual after updating `create-grist-widget`, then `pnpm typecheck`.

### Patch Changes

- 04fcfe6: **One way to do each thing: `fetchRows()`, `grist-widget-sdk/actions`, and soft deprecations.**
  
  ```ts
  const rows = await w.fetchRows()                       // the section's rows, in its order
  const people = await w.fetchRows("People")             // any table's rows (full access)
  const columns = await w.fetchRows({ columnar: true })  // Grist's own column-oriented payload
  
  import { gristAddColumnAction } from "grist-widget-sdk/actions"
  ```
  
  - `useGrist().fetchRows(tableId?, options?)` replaces three readers. Without a table id it reads the widget's own section (filters and sort applied); with one, any table, in Grist's order (`order`, `columns` as before). Rows by default, `{ columnar: true }` for columns.
  - `grist-widget-sdk/actions` is the user actions' own entry point, with the bulk record builders (`gristBulkAddRecordAction`, `gristBulkUpdateRecordAction`, `gristBulkRemoveRecordAction`) the root entry never exported.
  - Deprecated, removed in 1.0: `useGristContext()` (use `widget.useGrist()` or `useGrist()`); `useGrist().isReady` and `isAvailable`, and `useGristSchema().isAvailable` (use `status`); `fetchSelectedTable`, `fetchTable` and `fetchTableRows` (use `fetchRows`); the nine user-action builders in the root entry (import them from `grist-widget-sdk/actions`). Each still works, is struck through in the editor (`@deprecated`), and warns once in development with what replaces it; a production build stays silent. https://gristwidgets.com/docs/sdk/api/deprecated lists them.
  - The examples (`create-grist-widget --example`) are declared with `defineGristWidget()` and use none of the deprecated names.
  
  Existing widgets keep working unchanged. To clear the warnings, replace each name as the deprecations page says.

## 0.5.0

### Minor Changes

- 734d307: **`pnpm dev` opens the widget in real Grist, in the browser, with no Docker.** The template ships its demo page (`public/demo/`, a document for its widget and the page that opens it in grist-static), and on the dev server `http://localhost:5173/demo/index.html` runs that Grist on the dev server's own widget: edits reload in place, writes land in the document. The SDK's local-dev page links to it (or says how to get it, `pnpm demo --save`, when the widget has no demo page yet). The scaffold puts the widget's title in the page.
  
  Existing widgets can do nothing: those with a demo page (`pnpm demo --save`) already get it on `pnpm dev` at `/demo/index.html`; the others get it once they run `pnpm demo --save` (Docker, once).
- d08727f: **The template declares the widget with `defineGristWidget()`, and nothing a widget customises lives in `src/main.tsx` any more.**
  
  - `src/app/App.tsx` exports `widget` (access, columns, title, description) and the widget, about 40 lines: a typed read, a typed write (`w.updateRecord({ Done: !Done })`), no generics, no hand-written row types (`grist-types.example.ts` is gone).
  - `src/main.tsx` is `mountGristWidget(entry, { dev })`, with `entry` the module `src/app/App.tsx`. It reads `widget` or `GRIST_OPTIONS`, and `Alerts`, `LocalDevPage` and `ReleasePage` when the widget exports them, so it is the same in every widget.
  - `src/app/App.test.tsx` uses `renderWithGrist(<App />, { widget, rows })`; the smoke test is `smokeTestWidget(entry)`, valid for a widget declared either way.
  - `upgrade` refuses to overwrite something of the widget's own: a `src/main.tsx` that is none of the ones the template has shipped (formatting aside), or a file at a path a newer template starts using. `upgrade --force` overwrites them anyway.
  - The manifest, `demo` and `demo --save` read the `widget` declaration (also from `src/app/widget.ts`), or `GRIST_OPTIONS` and `WIDGET_METADATA` as before.
  
  Existing widgets can run `pnpm exec create-grist-widget upgrade` (after updating `grist-widget-sdk` and `create-grist-widget` to 0.5.0): it rewrites `src/main.tsx` and keeps the widget working with its `GRIST_OPTIONS`. A widget that customised its `src/main.tsx` (its own `Alerts`, a provider) moves that into `src/app/App.tsx` first, as exports or inside `App`; `upgrade` says so. Switching to `defineGristWidget` is optional: see [Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading#widgets-declared-with-grist_options).

### Patch Changes

- ca3f010: The template's README matches 0.4.0: `GristBoundary` shows a "Map your columns" screen until the required columns are mapped (it named the removed `canRender` capability), a mapped cell is its declared type or `null`, and it no longer says that no manifest is generated (every channel serves `grist-widget.json`). Existing widgets can do nothing: `README.md` is the widget's own, and `upgrade` leaves it as it is.

## 0.4.0

### Minor Changes

- a257767: `create-grist-widget demo --save` (`pnpm demo --save` in a widget) writes the widget's demo page into `public/demo/`: its `demo.grist` document, generated in the same Docker Grist as `pnpm demo`, and an `index.html` that opens it in Grist running in the browser from static files (grist-static, the pinned version gristwidgets.com serves). Vite copies `public/` into every build, so each deployed channel serves its own demo next to the widget (`…/latest/demo/`, `…/v1.2.0/demo/`, `…/dev/demo/`): the document holds a placeholder widget URL the page points at the build beside it. The widget's `grist-widget.json` gains `gristWidgetSdk.demo` when it has one, and the registry's "Try it" opens it.
  
  Existing widgets can run `pnpm demo --save` once they depend on this version, then commit `public/demo/`; nothing else changes.

### Patch Changes

- f4a467a: Routine dependency updates via Dependabot (PR #241). See the PR diff for the exact version bumps.

## 0.3.32

### Patch Changes

- 60620db: Every deployed widget now serves `grist-widget.json`, its Grist manifest, next to `index.html` on each channel (`/v<version>/`, `/latest/`, `/dev/`). The deploy workflow's build job writes it with the new `create-grist-widget manifest --base <path>`, from the widget's own `WIDGET_METADATA` and `GRIST_OPTIONS`. It is a Grist custom widget entry, the format of the widget list a self-hosted Grist reads through `GRIST_WIDGET_LIST_URL` (`name`, `widgetId`, `url`, `accessLevel`, `columns`, `description`, `authors`, `lastUpdatedAt`), plus a `gristWidgetSdk` key with the widget's version and license and the SDK and CLI versions it was built with. A `/dev/` build is marked `"published": false`. The awesome-grist-widgets registry reads it to show what each widget declares, without running its code.
  
  Existing widgets get it with their next `pnpm exec create-grist-widget upgrade`, which brings the new `deploy.yml`; the manifest appears with the next deploy.

## 0.3.31

### Patch Changes

- 68685db: New `create-grist-widget demo`, `pnpm demo` in a widget: the widget in a real Grist on your machine, with no account. It starts the widget's Vite dev server and a Grist from a pinned Docker image, creates a document from the widget's `GRIST_OPTIONS` (a typed column per declared column, sample rows, every column mapped, the access it requests), and prints the URL that opens it. Edits reload in place, Ctrl-C stops both, and the widget gets the plugin API from that Grist, so it works offline. Docker is needed for this command only. `--port <n>` moves Grist off port 8484.
  
  Existing widgets get the `demo` script with their next `pnpm exec create-grist-widget upgrade`, since the template's scripts are merged into `package.json`. Until then, `pnpm exec create-grist-widget demo` runs it.

## 0.3.30

### Patch Changes

- 9cf8367: `create-grist-widget upgrade` no longer rewrites `components.json`. It is shadcn's configuration, and a widget adds to it the registries `shadcn add` installs from (`"@kibo-ui": "https://www.kibo-ui.com/r/{name}.json"`, say). Since 0.3.28, `upgrade` replaced it with the template's copy, which has none, so `shadcn add @kibo-ui/...` stopped working. `components.json` now belongs to the widget, like `src/index.css`. The template's `AGENTS.md` and the Upgrading a widget page say so.
  
  Existing widgets that ran `upgrade` with 0.3.28 or 0.3.29 can check `git diff` on `components.json` in that upgrade's commit, and put back any `registries` entry it dropped. The next `upgrade` brings the corrected `AGENTS.md`.

## 0.3.29

### Patch Changes

- 85b34d4: The scaffold's docs now cover two routines. The README's one-time setup recommends branch rulesets, to set after the first release (which itself commits to `main` and resets `dev`): `main` requires a pull request and the `check` status from `ci.yml`, and blocks force pushes and deletion; `dev` blocks force pushes and deletion. `AGENTS.md` tells an agent that template updates arrive with Dependabot's `create-grist-widget` pull request, followed by `pnpm exec create-grist-widget upgrade` on `dev`.
  
  Existing widgets can:
  
  1. Add the rulesets: Settings → Rules → Rulesets, as above.
  2. Get the new `AGENTS.md` with their next `pnpm exec create-grist-widget upgrade`, since it is one of the template's files. `README.md` is the widget's own, so copy the ruleset section from the template's README if you want it there.

## 0.3.28

### Patch Changes

- a49367f: New `upgrade` command. Run inside a widget, on `dev`, `pnpm exec create-grist-widget upgrade` brings the template's files up to the template of the `create-grist-widget` version the widget depends on, so template changes no longer have to be applied by hand from these notes.
  
  - **The template's files** (listed on [Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading#the-templates-files)) are rewritten, or added if missing.
  - **`tsconfig.app.json` and `tsconfig.node.json`**, if one extends nothing yet (it predates the compiler settings `grist-widget-sdk` ships), are switched to the template's, keeping the `types` the widget listed. Once they extend a base, they're left alone.
  - **Files earlier templates wrote** that the current one doesn't (`scripts/deploy.mjs`, the old landing-page and status-chip components…) are deleted, unless a file of the widget's still refers to one: then `upgrade` keeps it and says which file does.
  - **`package.json`**: the template's scripts replace the widget's of the same name. Each template dependency is added if missing, or raised where the widget's range allows older versions; nothing is lowered or removed. `createGristWidgetVersion` records the version.
  - **`pnpm-workspace.yaml`**: `minimumReleaseAgeExclude` entries for versions now old enough for pnpm's age check are removed. `upgrade` looks up their publish time on the npm registry and keeps an entry it can't check.
  - **The widget's own files are never touched**: `src/app/` (its smoke test included), `src/components/ui/`, `src/index.css`, `README.md`, `index.html` and everything the widget added.
  - It refuses to run outside a git repository, on `main`, with uncommitted changes, on a widget still in `src/App.tsx`, or on one already on a newer template.
  
  Existing widgets can use it on `dev`:
  
  1. Update `create-grist-widget` to this release or later: merge Dependabot's pull request, or `pnpm update create-grist-widget`. A widget scaffolded before it was a dependency adds it, `pnpm add -D create-grist-widget`. pnpm picks the newest version that is at least a day old; if this release is younger than that, wait a day rather than adding an age exception.
  2. If the widget is still in `src/App.tsx`, [move it into `src/app/`](https://gristwidgets.com/docs/cli/upgrading#widgets-scaffolded-before-srcapp), its tests with it, and commit.
  3. `pnpm exec create-grist-widget upgrade`, then `pnpm install`, `pnpm typecheck`, `pnpm lint` and `pnpm test`. Review `git diff`, commit, and check the `/dev/` preview before releasing.
- 239e793: A new scaffold keeps its widget in `src/app/`: `App.tsx`, its tests (the smoke test included) and `grist-types.example.ts` are there, and `src/main.tsx` imports `./app/App`. `src/app/` is the widget's own, and is where its other files go; the smoke test is the widget's to extend, say with a `vi.mock` for a browser API jsdom lacks. The files the template writes around it (`src/main.tsx`, the workflows, the build configuration) stay identical in every widget, so a template change no longer has to be merged into widget code. `tsconfig.app.json` and `tsconfig.node.json` are the widget's: their compiler settings come from `grist-widget-sdk`, and they keep the widget's own paths and types. The template's `AGENTS.md` and the [Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading#the-templates-files) page list them.
  
  `create --example` and `use` write the example into `src/app/`, with the template's smoke test, and `use` replaces that folder whole. It refuses a project whose widget is still in `src/App.tsx`. On a repository copied with "Use this template", the deploy command's first release sets the title in `src/app/App.tsx`, or in `src/App.tsx` in a copy of an older template repository.
  
  Existing widgets keep working as they are. They can move on `dev` ([steps](https://gristwidgets.com/docs/cli/upgrading#widgets-scaffolded-before-srcapp)):
  
  1. `mkdir -p src/app && git mv src/App*.tsx src/app/`: `App.tsx`, and `App.test.tsx` and `App.smoke.test.tsx` if there are.
  2. In those files, turn imports of `./…` into `@/…`, except the tests' imports of `./App`.
  3. If `GRIST_OPTIONS` lives in a file of its own, re-export it from `src/app/App.tsx`.
  4. In `src/main.tsx`, import from `./app/App`.
  5. Run `pnpm typecheck`, `pnpm lint` and `pnpm test`, then commit.

## 0.3.27

### Patch Changes

- 7fd1119: The GitHub Pages deploy logic now ships in this package, as a `grist-widget-deploy` command, instead of being copied into every widget as `scripts/deploy.mjs`. Scaffolds depend on `create-grist-widget` at the version that made them, and `.github/workflows/deploy.yml` runs `node_modules/.bin/grist-widget-deploy plan|place|finalize|reset-branches|remove`. Deploy fixes now arrive as a Dependabot update, in a pull request of their own (`dependabot.yml` keeps `create-grist-widget` out of the routine group) and after the 7-day cooldown, instead of a file to copy by hand.
  
  The publish job still runs no dependency code next to its `contents: write` token: it installs with `--ignore-scripts` and calls the bin directly, at the version and integrity hash the lockfile pins. The command imports Node built-ins only, which a test enforces. A widget scaffolded on a CLI release day also gets pnpm's own `minimumReleaseAgeExclude` entry for that CLI version, as it already did for the SDK; it's moot once the version is a day old.
  
  Existing widgets can switch on `dev`:
  
  1. `pnpm add -D create-grist-widget`, and commit `package.json` and `pnpm-lock.yaml`. pnpm picks the newest version that is at least a day old, which has to be this release or later: if this release is younger than that, wait a day rather than adding an age exception.
  2. Copy the new workflow and Dependabot config from the template repository: `git fetch https://github.com/ArthurBlanchon/grist-widget-template main && git checkout FETCH_HEAD -- .github/workflows/deploy.yml .github/dependabot.yml`.
  3. `git rm scripts/deploy.mjs`.
  
  The next push to `dev` deploys with the new command; check that run before releasing.
- c5ea5c8: Scaffolded widgets now ship a smoke test, `src/App.smoke.test.tsx`: one call to the SDK's `smokeTestWidget()`, which mounts the widget inside an emulated Grist with every declared column mapped and checks it renders. `ci.yml` runs it on every pull request, so an SDK update that breaks the widget turns its Dependabot pull request red before the merge. The file stays when `create --example` or `use` swaps in an example. Running it on every example found two, `reads-demo` and `safe-parse`, that called full-access APIs while requesting only `read table` access; they now request `full`.
  
  Existing widgets can add the test on `dev`, once `grist-widget-sdk` is at this release or later: copy `src/App.smoke.test.tsx` from the template repository (`git fetch https://github.com/ArthurBlanchon/grist-widget-template main && git checkout FETCH_HEAD -- src/App.smoke.test.tsx`), then run `pnpm test`. A widget that already has a hand-written smoke test can replace it the same way, keeping any module mock it needs (a `vi.mock()` for a WebGL map library, for instance) at the top of the file.

## 0.3.26

### Patch Changes

- 7d7236d: Scaffolded widgets' `src/main.tsx` is now one call to `mountGristWidget()` from `grist-widget-sdk/app`, which renders what the template's own files did: the alerts above the widget inside Grist, and the local-dev and release pages outside it. Two changes come with it:
  
  - Inside Grist, widgets now follow **Grist's light/dark theme** instead of the OS setting, and the `d` shortcut only works outside Grist.
  - The release and local-dev pages show the widget's own name (they said "grist-widget-template"), and the local-dev page names the right CLI, `npx create-grist-widget list`.
  
  The template drops `src/components/grist-sdk-alerts.tsx`, `local-dev-notice.tsx` and `release-info.tsx`, and `src/lib/showcase-routing.ts` and `showcase-versions.ts`. `src/components/theme-provider.tsx` now re-exports the SDK's `useTheme()`.
  
  Existing widgets can switch on `dev`, once `grist-widget-sdk` is at this release or later:
  
  1. Replace `src/main.tsx` with:
  
     ```tsx
     import { mountGristWidget } from "grist-widget-sdk/app"
  
     import "./index.css"
     import App, { GRIST_OPTIONS } from "./App.tsx"
  
     mountGristWidget({ App, options: GRIST_OPTIONS, dev: import.meta.env.DEV })
     ```
  
     If your `main.tsx` did more, keep it: wrap `App` in your own providers in a small component and pass that, pass a `React.lazy()` component to load the widget only inside Grist, or pass your alert component as `Alerts`.
  2. Delete `src/components/grist-sdk-alerts.tsx`, `local-dev-notice.tsx`, `release-info.tsx`, `src/lib/showcase-routing.ts` and `src/lib/showcase-versions.ts`, plus `TemplateLanding` or `ScaffoldFooter` files if an older scaffold left them.
  3. Replace `src/components/theme-provider.tsx` with `export { useTheme } from "grist-widget-sdk/app"`, so components that import `useTheme` from it keep working.
  4. Run `pnpm typecheck` and `pnpm test` to confirm nothing else used the removed files.

## 0.3.25

### Patch Changes

- bbcca4d: Scaffolded widgets' `tsconfig.app.json` and `tsconfig.node.json` now extend the TypeScript settings that `grist-widget-sdk` ships (`grist-widget-sdk/tsconfig/app.json` and `/tsconfig/node.json`), so compiler-setting changes arrive with SDK updates instead of a hand edit in each widget. Each file keeps only what is specific to the widget: `tsBuildInfoFile`, `paths`, `include` and `types`, plus `noEmit`, which is repeated so that a missing base fails the typecheck without writing `.js` files next to the sources. The resolved settings are unchanged.
  
  Existing widgets can do the same on `dev`, once `grist-widget-sdk` is at a version that ships the base (this release or later) and TypeScript is 5.8 or later: copy both files from the template repository (`git fetch https://github.com/ArthurBlanchon/grist-widget-template main && git checkout FETCH_HEAD -- tsconfig.app.json tsconfig.node.json`), then add back any compiler option of your own; an option set in the widget's file overrides the base. `pnpm typecheck` confirms the result.

## 0.3.24

### Patch Changes

- 1ffe855: New widgets are now installed with pnpm, whichever package manager runs the CLI. Since 0.3.23 the first commit includes the lockfile, but `npm create grist-widget` runs the CLI under npm, so that lockfile was a `package-lock.json`. The widget's workflows install with pnpm and never read it, so CI and deploys still resolved dependencies afresh, and npm skipped the 24-hour release-age check that `pnpm-workspace.yaml` sets for pnpm. The first commit now holds `pnpm-lock.yaml` however the CLI is run. Without pnpm installed, the CLI installs nothing and says how to get it; `--pm <name>` still installs with another package manager.
  
  Existing widgets scaffolded with `npm create grist-widget` (a committed `package-lock.json`, no `pnpm-lock.yaml`) can switch on `dev`: run `git rm package-lock.json`, then `pnpm install`, and commit `pnpm-lock.yaml`. If pnpm adds a `minimumReleaseAgeExclude` entry (only for a version less than a day old), commit it too; otherwise wait a day.

## 0.3.23

### Patch Changes

- 6a3288b: New widgets are now locked from their first commit. `create` and `init` install dependencies **before** making the first commit, so `pnpm-lock.yaml` is in it: versions are pinned with their integrity hashes, pnpm freezes the install in CI by itself, and Dependabot updates the lockfile. Before, the CLI committed first and installed after, so a widget had no lockfile unless its author committed one later, and every CI and deploy run resolved dependencies afresh. `--no-install` still works as before, with no lockfile.
  
  pnpm 11 won't install a version published less than 24 hours ago. A widget scaffolded on the day of an SDK release therefore also gets one `minimumReleaseAgeExclude` entry in `pnpm-workspace.yaml`, written by pnpm, for that SDK version only. The CLI explains it when it happens, and the entry stays in the commit: without it, every later install would reject the lockfile until the version is a day old.
  
  Existing widgets can do the same on `dev`: run `pnpm install`, then commit `pnpm-lock.yaml`. If pnpm adds a `minimumReleaseAgeExclude` entry (only for a version less than a day old), commit it too; otherwise wait a day.
- f0ca7a0: Scaffolded widgets' deploy workflow (`.github/workflows/deploy.yml`) now builds and publishes in two jobs. `build` installs and builds with a read-only token, then hands `dist/` over as an artifact. `publish` holds `contents: write` but installs nothing: it only runs `scripts/deploy.mjs`, which uses Node built-ins only. Before, `pnpm install` and the Vite build ran in the same job as a token that could push to the repo and rewrite `gh-pages`, the build served inside Grist documents, so a compromised dependency could have done the same. Event values also reach the shell through `env:` instead of `${{ }}` inside `run:`. What gets deployed, and where, is unchanged.
  
  Existing widgets can take the new workflow together with the deploy script it calls, on `dev`, from the template repository: `git fetch https://github.com/ArthurBlanchon/grist-widget-template main && git checkout FETCH_HEAD -- .github/workflows/deploy.yml scripts/deploy.mjs`. Copy both: an older `deploy.mjs` may not support every subcommand the workflow uses.
- c87f20c: Scaffolded widgets no longer render `GristStatusChip`, the connection-status pill pinned over the widget: it covered the widget's own content, and it only repeated what is already shown when it matters. Until Grist is connected, or when the connection is lost or fails, `GristBoundary` replaces the widget with a connecting / unavailable / error screen (with a retry button on errors); once the widget is showing, `GristSdkAlerts` reports what needs attention. The template drops `src/components/grist-status-chip.tsx` and `src/lib/grist-handshake-status.ts`, which only the chip used.
  
  Existing widgets can do the same: delete those two files, then remove the `GristStatusChip` import and the `<GristStatusChip />` element wherever the widget renders it (the template put it in `src/main.tsx`, just inside `<GristWidgetProvider>`). `pnpm typecheck` then confirms nothing else referenced them.
- c474216: A widget's README now states its install URL. On the widget's first release, `scripts/deploy.mjs` writes its GitHub Pages `/latest/` URL into a marked block at the top of `README.md` (it's in the same commit as the rest of the first-release reset). That makes the widget eligible for the [awesome-grist-widgets](https://github.com/ArthurBlanchon/awesome-grist-widgets) registry, which only lists widgets whose own repo documents the URL. A custom Pages domain isn't detected, so edit the line if the widget uses one.
  
  Existing widgets can add the block by hand, under the README's first paragraph:
  
  ```md
  <!-- install-url:start -->
  **Install URL**, to paste into a Grist custom widget's URL field: <https://OWNER.github.io/REPO/latest/>
  <!-- install-url:end -->
  ```

## 0.3.22

### Patch Changes

- 8f2015e: Scaffolded widgets' `.github/dependabot.yml` no longer proposes TypeScript 7. `typescript-eslint` doesn't support it yet, so every such pull request failed `pnpm lint` in the new `ci.yml` (seen on the template repository's first Dependabot run). Existing widgets that copied the file can re-copy it from the template repository, or add under the `npm` entry: `ignore: [{ dependency-name: "typescript", versions: [">=7"] }]`.

## 0.3.21

### Patch Changes

- 1d0d1ad: Scaffolded widgets now keep themselves current. A new `.github/dependabot.yml` opens weekly pull requests against `dev` for the widget's npm dependencies and its workflows' GitHub Actions: minor and patch bumps grouped into one PR, `grist-widget-sdk` updates in a PR of their own, and only versions at least a week old. A new `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm test` and `pnpm build` on every pull request; until now a widget's pull requests had no checks at all, since `deploy.yml` only builds, and only after a push. A new docs page, [Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading), covers the update loop and how to pick up template changes.
  
  Existing widgets can copy both files from the template repository, on `dev`: `git fetch https://github.com/ArthurBlanchon/grist-widget-template main && git checkout FETCH_HEAD -- .github/dependabot.yml .github/workflows/ci.yml`. Run `pnpm lint`, `pnpm test` and `pnpm build` once first, since the new checks run all three.

## 0.3.19

### Patch Changes

- 42b41fe: Scaffolded widgets now use TypeScript 6 and vitest 5. Their `tsconfig.json` / `tsconfig.app.json` drop `"baseUrl": "."`, which TypeScript 6 deprecates (error TS5101): `paths` already resolves relative to the tsconfig, so `@/…` imports and shadcn's alias resolution are unchanged. Existing widgets moving to TypeScript 6 can delete that line the same way.

## 0.3.18

### Patch Changes

- 2baf211: Scaffolded widgets' deploy workflow (`.github/workflows/deploy.yml`) now uses `actions/checkout` v7, `actions/setup-node` v7 and `pnpm/action-setup` v6 — the v4s ran on GitHub's deprecated Node 20 action runtime. Existing widgets can copy those three `uses:` lines (and `package-manager-cache: false` under `setup-node`) from a fresh scaffold. The CLI's `engines` now declares Node `^22.22.0 || >=24.15.0`, the range a scaffolded widget actually needs to run its tests (jsdom 30); it still said `>=18`.

## 0.3.17

### Patch Changes

- f7d9e54: Routine dependency updates via Dependabot (PR #172). See the PR diff for the exact version bumps.

## 0.3.16

### Patch Changes

- 91c1ca6: Scaffolded widgets now ship with vite 8, @vitejs/plugin-react 6, eslint 10 (+ @eslint/js 10, globals 17), jsdom 30, @testing-library/jest-dom 7, @types/node 26 and the latest React 19.3, radix-ui, lucide-react, shadcn and typescript-eslint minors. Running a scaffolded widget's tests now needs Node.js 22.22+ or 24.15+ (jsdom 30's engine range).

## 0.3.15

### Patch Changes

- 80b2ed1: Routine dependency updates via Dependabot (PR #141). See the PR diff for the exact version bumps.

## 0.3.14

### Patch Changes

- ed810fd: Scaffolded widgets now get a real favicon instead of the default Vite logo, and no longer carry an unused `react.svg` asset.

## 0.3.13

### Patch Changes

- d367363: Fixed two doc links in the scaffolded template's README and the CLI package's own README that pointed at pages moved during a docs restructure (`getting-started` → `/docs/sdk` and `/docs/quickstart`, `testing` → `/docs/emulator/testing`).

## 0.3.12

### Patch Changes

- a253bc7: Fixed two doc links in the scaffolded template's README and the CLI package's own README that pointed at pages moved during a docs restructure (`getting-started` → `/docs/sdk` and `/docs/quickstart`, `testing` → `/docs/emulator/testing`).

## 0.3.11

### Patch Changes

- 0f63fb3: The scaffolded template no longer ships ~326 lines of dead onboarding UI (`TemplateLanding`, `ScaffoldFooter`) that every real widget repo inherited and had to find and manually delete. Opened outside Grist, `pnpm dev` now renders a minimal `LocalDevNotice` — states plainly that a local dev server proves nothing about real Grist behavior, and points at the actual verification loop (push to `dev`, open `/dev/` in a real Grist document). Any deployed build (root, `/latest/`, `/dev/`, `/v<version>/`) renders `ReleaseInfo` (renamed from `ChannelNotice`) — unchanged behavior, except each version chip now shows its publish date on hover and the now-target-less "back to hub" link is gone.

  No breaking changes: the widget contract (three exports from `src/App.tsx`, wired by `src/main.tsx`) and the deploy pipeline are unchanged.

## 0.3.10

### Patch Changes

- ba0b25f: Fixed `pnpm test` failing outright ("No test files found", exit 1) in any scaffold that ends up with zero test files — which is every `create --example <id>`, `init --example <id>`, and `use <id>` today, since none of the SDK's example widgets ship their own `WidgetApp.test.tsx` yet and swapping one in correctly removes the template's own test (which would otherwise assert against content that's no longer there). The template's `vitest` config now sets `passWithNoTests: true`, so a scaffold with no tests reports green (0 tests) instead of failing. Found live testing the real published `create-grist-widget@0.3.9`.

## 0.3.9

### Patch Changes

- 31dfc9b: Fixed the root cause of `create-grist-widget@0.3.8`'s failed npm publish: this package's own build step (run by `prepack` on every `npm publish`, and by `pnpm --filter create-grist-widget build`) now generates the widget examples manifest itself if it isn't already present, instead of throwing and requiring a separate `pnpm build:widgets-manifest` step to have been run first by whoever's building it. This had already caused two CI failures before hitting the real release pipeline; it can no longer recur for this package regardless of what invokes its build.

  No behavior change for consumers — `list`/`use`/`create --example` are unaffected either way.

## 0.3.8

### Patch Changes

- eec20b5: `create-grist-widget` is now a four-verb engine, all fully offline:
  - `create <name> [--example <id>]` — the existing scaffold command, now also able to start from any of the SDK's example widgets instead of the blank template. Bare `npm create grist-widget <name>` still works exactly as before.
  - `init [--example <id>]` — scaffolds into the **current** directory instead of a new one, for an already-cloned or agent-initialized repo. Fixes the CLI previously refusing any non-empty target directory.
  - `use <example-id>` — swaps the current project's widget for a different example, gated on a clean git working tree so the swap is always a single reviewable, revertible diff.
  - `list [--json]` — prints the available starting examples.

  `create` also gained `--help`/`--version`, an interactive prompt (name + starting example) when run with no arguments, and automatic dependency installation after scaffolding (detecting the invoking package manager; opt out with `--no-install`).

  Every example, and the logic that composes one onto the template, now ships embedded in the published package — nothing beyond the initial `pnpm/npm/yarn install` is ever fetched over the network.

  Also: a scaffolded repo's bundled deploy pipeline now fails loudly, instead of silently publishing nothing, when a push to `main` would be a no-op release because `package.json`'s version wasn't bumped since the previous commit.

  No breaking changes: the default `create <name>` scaffold, its file layout, and the bundled deploy pipeline's two-channel model are all unchanged.

## 0.3.7

### Patch Changes

- 2d2bfca: A repo created via GitHub's "Use this template" button (rather than `npm create grist-widget`) now gets fully personalized on its first genuine release, with no manual steps: `scripts/deploy.mjs`'s existing first-release guard now also rewrites the same four placeholder-identity spots the CLI's own scaffold rename touches — `package.json`'s `name`, `README.md`'s heading, `index.html`'s `<title>`, and `App.tsx`'s `WIDGET_METADATA.title` — alongside its existing version reset and stray-branch cleanup. A CLI-scaffolded repo is unaffected: the rename only ever touches files that still carry the template's own placeholder text.

  No breaking changes: the deploy pipeline's two-channel model and `gh-pages` layout are unchanged.

## 0.3.6

### Patch Changes

- ab2e162: The scaffolded widget is no longer a debug dump. `src/App.tsx` now ships with `GRIST_OPTIONS.columns` declared (`title`, `done`) and a small editable form that reads and writes the selected row via `w.mappedRecord`/`w.mapBack`/`w.table.update` — the smallest real starting point instead of a placeholder. It also now ships a real `App.test.tsx` (using `renderWithGrist` + `presets` from `grist-widget-sdk/emulator/testing`), a `test` script, and the `vitest`/`jsdom`/`@testing-library/*` devDependencies it needs — `pnpm test` works in every new scaffold.

  No breaking changes: the widget contract (three exports from `src/App.tsx`, wired by `src/main.tsx`) is unchanged.

## 0.3.5

### Patch Changes

- 3cd425c: Every scaffolded widget now ships an `AGENTS.md` (the widget contract, the operating rules, the one-time GitHub Pages settings, and the "merging without a version bump publishes nothing" footgun) and a `CLAUDE.md` that imports it. Neither existed before — an agent opening a fresh scaffold had no repo-specific guidance at all.

  No runtime behavior changes.

## 0.3.4

### Patch Changes

- 64db3c3: Fixed a dead `grist-widgets.com` link in the scaffolded template's `README.md` (repointed at the live `gristwidgets.com` docs site), and moved `shadcn` from a runtime `dependency` to a `devDependency` in the template — it's a CLI used to add UI components, never imported by application code, and it was shipping in every scaffolded widget's production dependency tree.

  No runtime behavior changes.

## 0.3.3

### Patch Changes

- bb1f20a: Point package metadata and documentation links at the live docs site.

  Both packages' `homepage` fields pointed at `grist-widgets.com`, a domain with
  no DNS record, so the Homepage link on both npm pages was dead. They now point
  at `https://gristwidgets.com`.

  The README links that resolved into `apps/docs/` — a directory that has been
  removed from the repo — now point at the equivalent pages on the docs site, so
  they keep working for anyone reading the package on npm. The same fix applies
  to the template README that ships inside every scaffolded widget.

  No runtime behavior changes.

## 0.3.2

### Patch Changes

- def69ab: Update the embedded template's README: the "Live preview inside the monorepo" section describing a `/template/` showcase deploy inside `grist-widget-sdk` itself has been removed, since that pipeline (`deploy-template-showcase.yml`) no longer exists — the template's live preview now lives only on the external `grist-widget-template` reference repo via `template-canary.yml`. No functional change to the scaffolded widget itself, only to the shipped README's "Live preview" section.

## 0.3.1

### Patch Changes

- d51fb38: Fix a fresh scaffold potentially inheriting the wrong starting `version`. `build-template.mjs` now force-sets the embedded template's `package.json` `version` to `0.0.1` at build time, regardless of what `templates/grist-widget-template-vite/package.json` says in the source repo — that file's own version had drifted to `0.0.2` as a side effect of Changesets bumping every workspace package with a `workspace:^` dependency on `grist-widget-sdk`, private or not. (That source is now excluded from version bumps entirely via `.changeset/config.json`'s `ignore`, so this is belt-and-suspenders against any other future drift.) A fresh `npm create grist-widget` scaffold's own `version` is meant to start at `0.0.1` unconditionally — it's the widget author's version to own from that point on, unrelated to this repo's release cadence.

## 0.2.25

### Patch Changes

- e78360f: "Use this template" now publishes a clean `v0.0.1` + `/latest/` + root the moment the repo is created, instead of publishing nothing until the first real release. Reverts the earlier ref-created-push skip (which left a fresh copy with no usable widget URL, only a landing page): a repo's first genuine release always resolves to `v0.0.1` regardless of the inherited `package.json` version, and the first-release reset step now also rewrites `package.json`'s version back to `0.0.1` in the repo so the _next_ release bumps cleanly to `0.0.2` rather than the inherited canary number. Removes the now-unused `--created`/`cleanup-foreign`/`place-root` subcommands; the broadened foreign-content cleanup (root/`latest/`, not just `v<version>/` dirs) is kept via the normal release path.

## 0.2.24

### Patch Changes

- 35deecd: Fix a fresh "Use this template" copy's repo-root URL 404ing until its first real release. The ref-created-push skip (previous release) stopped publishing anything on repo creation, which also removed the initial deploy that used to place the showcase-hub landing page at the site root. The ref-created push now still builds (with a repo-root base) and places the landing hub at root via a new `place-root` subcommand — without creating a `v<version>/` or `latest/`, so the first-release version override is still preserved and `/latest/`/`/v<version>/` correctly stay absent until a real release exists.

## 0.2.23

### Patch Changes

- 9a3b7f2: Fix a fresh "Use this template" copy rendering root/`latest/` blank until its real first release. The ref-created-push skip (previous release) never ran the deploy pipeline's foreign-content cleanup, since that used to only happen as a side effect of an actual release build. The cleanup is now broadened to clear every foreign top-level entry (not just `v<version>/` dirs) and runs standalone via a new `cleanup-foreign` subcommand on the skipped ref-created push. Also tightened the skip condition itself: gating on `github.event.created` alone would wrongly skip a CLI scaffold's own genuine first release too (its first `git push -u origin main` also creates that ref); it now additionally requires the push be authored by GitHub's web-flow bot, unique to server-side template generation.

## 0.2.22

### Patch Changes

- d995f96: Fix the bundled deploy workflow publishing a widget's real first release under an inherited placeholder version instead of `v0.0.1`. GitHub's "Use this template" fires the workflow once on repo creation, before any real work happens; that run is now recognized (the push that created the `main` ref) and skipped entirely, so it no longer spends the first-release version override.

## 0.2.21

### Patch Changes

- bdb3a52: The bundled dev-channel self-reload snippet now runs its first freshness check immediately on page load instead of waiting a full 5-second poll interval. Found live: a plain (non-cache-busted) request for `/dev/` can hit a stale CDN-cached `index.html` referencing JS assets a newer deploy already replaced, producing a blank/black screen — that screen now clears in well under a second (as soon as the fetch to `version.json` resolves) instead of up to ~5s.

## 0.2.20

### Patch Changes

- 133dfae: On a repo's first genuine release, `templates/grist-widget-template-vite`'s bundled deploy workflow now also prunes every branch except `main`, `dev`, and `gh-pages`, and force-resets `dev` to match `main`'s current tip — establishing the schema every widget should start from (`main == dev`, `gh-pages` managed by CI only) regardless of whether the repo came from `npm create grist-widget` (already true trivially) or GitHub's "Use this template" (may have inherited a stray branch, or a `dev` full of the source template's own unrelated preview history). Gated on the same first-release signal as the existing version-reset and foreign-content cleanup — runs once, permanently a no-op afterward.

## 0.2.19

### Patch Changes

- 8bbf2a8: A repo's first genuine release now always resolves to `v0.0.1`, regardless of whatever version is checked into `package.json` — found live: a repo copied via GitHub's "Use this template" inherited `0.2.18` from the source template repo's own `main` branch (itself a canary-verification scaffold that had been promoted there), instead of starting fresh. `templates/grist-widget-template-vite/scripts/deploy.mjs`'s `plan()` now ignores `package.json`'s `version` for a repo's first release only; once a genuine release exists, normal versioning resumes. Also, every scaffold (via the CLI or inherited through a template copy) now records which `create-grist-widget` version produced it in a new `createGristWidgetVersion` package.json field — purely informational, shown in a small footer ("Scaffolded from `create-grist-widget@X.Y.Z`") on the landing page and channel pages, never read by the deploy pipeline's own version logic.

## 0.2.18

### Patch Changes

- e07f8db: The bundled template's landing page now leads with a **Quickstart**: copy [`grist-widget-template`](https://github.com/arthurblanchon/grist-widget-template) via GitHub's "Use this template" button with "Include all branches" checked — live-verified to bring `gh-pages`/Pages fully configured with the `/dev/` and `/latest/` URLs already live, no manual Settings step. The CLI-based flow (`npm create grist-widget`) moves to a "Prefer the CLI?" section below it. Also adds a warning pointing at the Claude, Codex, and Cursor GitHub App install pages in case an AI coding agent can't see the newly copied repo.

## 0.2.17

### Patch Changes

- 5e5d56e: The bundled `scripts/deploy.mjs` now clears every foreign `v<version>/` directory before placing a repo's _first_ genuine release — but only when that repo has never genuinely published before (its `repo`-filtered `versions.json` is empty), so there's no ambiguity between "inherited noise" and "this repo's own history." This makes GitHub's "Use this template" → "Include all branches" (a legitimate way to get `gh-pages`/Pages already configured, no manual Settings step) safe to use: the copied template's own past releases get cleared automatically on your first real push to `main`, leaving just your `v0.0.1` + `latest` (+ `dev`).

## 0.2.16

### Patch Changes

- 0c884af: Fix the bundled `scripts/deploy.mjs`'s release "already-published" check and `versions.json` builder to verify a `v<version>/` directory was genuinely built by _this_ repo's own pipeline (matching `repo` in `showcase-meta.json`), not just that the path exists. A `gh-pages` branch manually seeded from another repo's export — or one inherited via GitHub's "Use this template" button along with copied `gh-pages` content — could otherwise permanently squat on a version path: the release step would silently skip it forever (reporting success while doing nothing), and its `publishedAt`/`version` could leak into the widget's own version index. Foreign content is now correctly treated as unpublished and safely rebuilt over.

## 0.2.14

### Patch Changes

- b0382a8: Fixed the showcase hub/channel-notice version index and its "dev"/preview links always pointing at the grist-widget-sdk monorepo's own showcase instead of the scaffolded widget's own site — found live on a real scaffold's landing page. `src/lib/showcase-versions.ts`'s `versionsUrl`/`devUrl`/`versionUrl` are now derived from the current deploy's own URL (via `parseShowcasePath`'s `hubPath`), not a hardcoded absolute URL. The bundled `deploy.mjs` now also generates the widget's own `versions.json` on every release (mirroring the monorepo showcase's `template-showcase.mjs`), which the standalone pipeline never did before. `scripts/smoke/template-deploy.sh` asserts both.

## 0.2.13

### Patch Changes

- 29fd012: Fixed the bundled deploy workflow's very first step failing on a real scaffolded widget's first deploy: `Error: Dependencies lock file is not found`. The CLI's auto-commit runs before anyone's first `pnpm install`, so a freshly scaffolded repo never has a committed `pnpm-lock.yaml` unless the user commits again — nothing prompts them to. `actions/setup-node`'s `cache: pnpm` and `pnpm install --frozen-lockfile` both hard-require one to exist; removed both, so the workflow installs fresh every run regardless of whether a lockfile was ever committed. `scripts/smoke/create-widget.sh` now asserts the bundled `deploy.yml` never reintroduces either.
- 29fd012: Fixed the bundled deploy workflow never placing a build at a scaffolded widget's own site root (`https://owner.github.io/repo/`), so it 404'd instead of showing the template's built-in showcase hub. `deploy.mjs`'s release step now also copies the release build to the site root, in addition to `v<version>/` and `latest/` — mirroring the monorepo's own `scripts/deploy/template-showcase.mjs`, which already did this for `/template/`. `scripts/smoke/template-deploy.sh` now asserts the root `index.html` is placed.
- 29fd012: Two showcase fixups found live on `template-widget`'s first real deploy:
  - Docs/warnings: the manual "enable GitHub Pages" step (template README, the CLI's own README, the showcase hub's onboarding instructions, `deploy.yml`'s header comment, and the `run-grist-widget-template-deploy` skill) now explicitly warns against pointing Pages at `main` instead of `gh-pages` — doing so serves the raw unbuilt source (a blank page with a `/src/main.tsx` 404) even though the deploy workflow itself reports success.
  - Removed the cosmetic, looping "Grist connected" demo chip from the showcase hub page (`TemplateLanding`) — it never reflected a real connection there and was more confusing than informative. The real, live status chip shown while actually embedded in Grist is unchanged.

## 0.2.12

### Patch Changes

- 4630d15: Reverted the scaffolded template's hub hero back to "Build a Grist custom widget in minutes". Replaced the "Using Claude Code?" box's collapsible "prefer to run it yourself?" fallback with a proper "Manual setup" tab alongside it, now an explicit step-by-step: scaffold and try it locally (`npm create grist-widget my-widget && cd my-widget && pnpm install && pnpm dev`), create the GitHub repo, push `main`/`dev`, then enable GitHub Pages. Also added a small, centered demo status chip at the top of the hub page — a cosmetic, looping cycle through the same visual states a real widget's `GristStatusChip` shows (connecting / retrying / connected), since the hub page itself never actually connects to Grist.

## 0.2.11

### Patch Changes

- a5e7533: Reworded the scaffolded template's hub hero from "Build a Grist custom widget in minutes" to "Build your own Grist custom widget".
- a5e7533: Polished the scaffolded template's "Using Claude Code?" onboarding box: the "Create a new repository" button now sits right after step 1 instead of at the bottom; the "Claude GitHub App" link opens in a new tab; and step 3 now includes an explicit, copyable prompt for pasting directly into a Claude Code session (points to https://www.npmjs.com/package/create-grist-widget and explains why the CLI needs a fresh subdirectory rather than scaffolding in place). The raw git commands moved into a collapsible "prefer to run it yourself?" section.

## 0.2.10

### Patch Changes

- 93ea7a3: The scaffolded template's hub and channel showcase pages now have distinct heroes instead of sharing the same headline. The channel notice shows chips to jump directly to any other released version or the dev channel. When actually embedded in Grist, a small pill now shows live handshake status (connecting, retrying with a countdown, connected) using `useGristHandshakeContext()` from `grist-widget-sdk/advanced` in its own `<GristHandshakeProvider>` — safe to coexist with `<GristWidgetProvider>`, purely observational.

## 0.2.9

### Patch Changes

- 24c472d: The scaffolded template now shows a minimal notice (which build this is, a link back to the template's own hub page, and a copy-this-URL helper for Grist's custom widget field) when a specific `/latest/`, `/dev/`, or `/v<version>/` build is opened outside Grist, instead of the full onboarding content — that now lives on a separate hub page shown for any URL without a recognized channel suffix. Chosen purely by URL shape at runtime (`src/lib/showcase-routing.ts`), no router involved. The landing page also now links to the `/dev/` channel, which it previously never mentioned.

## 0.2.8

### Patch Changes

- 069dcc0: Documents the monorepo's own `dev/template-showcase` live-preview branch in the scaffolded template's README ("Live preview inside the monorepo" section) — no functional change for scaffolded widgets, just an internal-development note that ships along with the rest of the README.

## 0.2.7

### Patch Changes

- 80b4cd0: Fixed the scaffolded template's landing page (`src/components/template-landing.tsx`) fetching `versions.json` and linking release previews at the wrong path — the monorepo's own template showcase moved from `gh-pages` root to `/template/` (a GitHub Pages project site needs the repo name in every absolute path; deploying to root produced a blank page). Both hardcoded URLs now point at `https://arthurblanchon.github.io/grist-widget-sdk/template/...`.

## 0.2.6

### Patch Changes

- b7db3ca: The scaffolded template now shows a "Grist isn't loaded here" landing page (`src/components/template-landing.tsx`) whenever it's opened outside a Grist iframe, instead of getting stuck on the SDK's "Connecting to Grist" placeholder forever. It walks through the Claude Code / `npm create grist-widget` onboarding flow and, when deployed, lists every released template version. Detected via `window.self === window.top` in `src/main.tsx`; the normal widget tree still mounts unchanged when actually embedded in Grist.

## 0.2.5

### Patch Changes

- 7b6e6ca: Show the immutable `/v<version>/` URL alongside `/latest/` in the "Using Claude Code?" section — it was only mentioning `/latest/`, even though the deploy pipeline (and the scaffolded template's own README) always publishes both.

## 0.2.4

### Patch Changes

- a9c0e4c: The CLI now initializes git itself: the scaffold is committed directly on `main` (the branch the deploy workflow releases from) with a `dev` branch ready alongside it, instead of leaving `git init`/`git commit`/branch setup to whoever runs next. Found via a live Claude Code test that committed the scaffold to its own working branch instead of `main` — since the deploy workflow only ever releases from `main`, that silently never deployed. Degrades gracefully (still initializes `main`, just without a commit) if no git identity is configured. Also corrects the README's Actions-permissions claim: it's a fallback fix for a permissions error, not a required first step — most repos don't need it.
- a9c0e4c: Make the recommended workflow explicit in both the scaffolded template's README and this package's own README: always develop on `dev`, and release by bumping `package.json`'s version and merging a PR from `dev` into `main`. Calls out clearly that merging without a version bump publishes nothing — the release build is idempotent and silently skips when the version already has a published directory.

## 0.2.3

### Patch Changes

- 60a5847: Fix two gaps found via a live scaffold + deploy test: the scaffolded project had no `.gitignore` (npm always strips a literal `.gitignore` from published packages, regardless of the `files` field — it now ships as `_gitignore` and is renamed back at scaffold time) and no `packageManager` field (the bundled deploy workflow's `pnpm/action-setup` step failed on a fresh repo's first CI run with "No pnpm version is specified" — now stamped from the monorepo's own pin at build time).

## 0.2.2

### Patch Changes

- 1539998: Bundle a two-channel GitHub Pages deploy workflow into the embedded template (`templates/grist-widget-template-vite/scripts/deploy.mjs` + `.github/workflows/deploy.yml`). A newly scaffolded widget now ships working release (`/v<version>/` + `/latest/`) and dev (`/dev/`, self-reload) channels out of the box, with no manual CI setup.
