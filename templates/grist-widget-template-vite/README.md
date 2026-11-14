# grist-widget-template-vite

Base template to build a Grist widget with `grist-widget-sdk`.

<!-- install-url:start -->
**Install URL**: written here by this widget's first release (its GitHub Pages `/latest/` URL).
<!-- install-url:end -->

`src/main.tsx` is one call, `mountGristWidget(entry, { dev })` from `grist-widget-sdk/app` ([reference](https://gristwidgets.com/docs/sdk/api/app)), with `entry` the module `src/app/App.tsx`. Inside Grist it renders the widget in `GristWidgetProvider` and `GristBoundary`, under the SDK's alerts, in Grist's light/dark theme. `src/components/theme-provider.tsx` re-exports its `useTheme()`, for shadcn components that need the theme in JavaScript.

Opened outside a Grist iframe, the page is never a live preview of the widget itself, since nothing there proves anything about real Grist behavior. Local `pnpm dev` shows a local-dev page pointing at the real loops: **`/demo/index.html`** on the dev server opens the widget in real Grist, running in the browser from the demo page in `public/demo/` (see below), on the dev server's own build, so edits reload in place with no Docker; and the `dev` branch's `/dev/` in a real Grist document. Any built or deployed URL (root, `/latest/`, `/dev/`, `/v<version>/`, all carrying the same build, see Deployment below) shows a release page instead: which build this is, links to every other version and channel (hover one to see when it shipped), and the URL to paste into Grist's custom widget field. Both come from the SDK and follow this widget's shadcn colors; to use your own, export `LocalDevPage` or `ReleasePage` from `src/app/App.tsx`.

When actually embedded, the widget shows connection state only when something is wrong: until Grist is connected, or if the connection is lost or fails, `GristBoundary` replaces the widget with a connecting / unavailable / error screen (the error one with a retry button); once the widget is showing, the SDK's alerts report what needs attention (column mapping, access level, a failed write…) above it. Nothing is drawn over the widget while all is well. Export your own `Alerts` component from `src/app/App.tsx` to render them differently, or `export const Alerts = null` for none. Every customisation is an export of `src/app/App.tsx`, never an edit of `src/main.tsx`: `upgrade` refuses to run over a changed `src/main.tsx`.

The widget lives in `src/app/`: `App.tsx`, and any components, hooks, helpers or assets it needs. `src/components/ui/` (shadcn primitives) and `src/index.css` (the theme) are yours too. `src/main.tsx`, the workflows and the Vite and ESLint config are the template's (`AGENTS.md` lists them): leave them as they are: `pnpm exec create-grist-widget upgrade`, run on `dev`, rewrites them when `create-grist-widget` is updated ([Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading)).

`src/app/App.tsx` declares the widget with `defineGristWidget()`: the access it asks for, two columns to map (`Title`, `Done`) with their types, its title and description. `widget.useGrist()` is typed from that declaration, with no generics: `w.mappedRecord.Title` is a `string | null`, and `w.updateRecord({ Done: true })` writes to the selected row, encoded for the column's type. The smallest real starting point, not a placeholder.

- **ESLint** blocks direct `grist` global usage in `src/` — use the SDK only.
- Edit the declaration's `columns` to change the required columns (or remove them to read raw, unmapped records instead). Until every required column is mapped, `GristBoundary` shows a "Map your columns" screen instead of the widget. Each mapped cell reaches `w.mappedRecord` as the value its declared type promises, or `null` when it doesn't match (listed in `w.cellIssues`): see [Typed reads](https://gristwidgets.com/docs/sdk/guide/typing).

Run `pnpm test`. `src/app/App.smoke.test.tsx` is the smoke test, one `smokeTestWidget(entry)` call that checks the widget renders inside an emulated Grist with every declared column mapped, and that CI runs on every pull request; see `src/app/App.test.tsx` for the pattern: `renderWithGrist(<App />, { widget, rows })` from `grist-widget-sdk/emulator/testing` runs the widget against its declared columns, mapped, with typed rows, no browser or real Grist doc needed. Full guide: [Testing](https://gristwidgets.com/docs/emulator/testing).

To see the widget in a real Grist on your machine, run `pnpm demo` (it needs Docker). It starts the dev server and a Grist from a pinned Docker image, creates a document from the widget's declaration (a typed column per declared column, sample rows, every column mapped, the access the widget asks for), and prints the URL that opens it: no account, nothing leaves your machine, and edits reload in place. Ctrl-C stops both, and each run starts from a fresh document. It is real Grist, not an emulation, so it shows what `pnpm test` can't; the `dev` branch's `/dev/` preview remains the check in your own documents. `pnpm demo --port 9090` moves Grist off port 8484.

The template ships `public/demo/`, a demo page for its own widget; `pnpm demo --save` rewrites it for yours (do it once your columns differ): the same document as `pnpm demo`, opened by Grist running in the browser from static files. Commit it, and every deployed channel serves it next to the widget (`…/latest/demo/`): a link anyone can open, with no server and nothing saved. To change its data, open `public/demo/demo.grist` in any Grist, edit it, and download it back over the file.

**Monorepo dev:** this template resolves `grist-widget-sdk` from `packages/core/dist` (like the other widgets), not from SDK source. After changing the SDK, run `pnpm prebuild` or `pnpm --filter grist-widget-sdk build` before `pnpm dev`.

## How this template is distributed

This is the **source** template. It is consumed two ways:

- **In the SDK monorepo (development):** it's a workspace member and depends on
  the SDK via `"grist-widget-sdk": "workspace:^"`, resolved from
  `packages/core/dist`. Run `pnpm --filter grist-widget-sdk build` after
  changing the SDK, then `pnpm dev` here.
- **Externally (your own repo):** the `create-grist-widget` CLI
  (`npm create grist-widget my-widget`) copies this template and rewrites the
  dependency to the published npm range (`^0.x`), so nothing points back at
  this repo. See [Quickstart](https://gristwidgets.com/docs/quickstart).

`pnpm-workspace.yaml` here only pre-approves esbuild's build script so a
standalone `pnpm install` (pnpm 11) exits cleanly; inside the monorepo it's
ignored (the root workspace governs).

A scaffold's first commit includes `pnpm-lock.yaml`: the CLI installs with
pnpm, even under `npm create`, unless it was run with `--no-install` or
without pnpm installed. Versions are pinned with their integrity hashes, CI
installs exactly that, and Dependabot updates it. A `package-lock.json` isn't
used: the workflows install with pnpm. pnpm 11 won't install a version
published less than 24 hours ago. So a widget scaffolded on the day of a
release also gets `minimumReleaseAgeExclude` entries in `pnpm-workspace.yaml`,
written by pnpm itself, for the `grist-widget-sdk` and `create-grist-widget`
versions it was made with, and nothing else. Keep them: without them, every
install (yours and CI's) rejects the lockfile until the version is a day old.
After that the entries are harmless.

### Live preview

This template has no live-preview deploy of its own inside this monorepo —
that used to exist (a `/template/` showcase on this repo's own GitHub
Pages) but has been retired. The only live preview of this template's
current source is external: `template-canary.yml` scaffolds it via the
*published* `create-grist-widget` package and pushes to the `dev` branch
(pre-release preview) and directly to `main` (stable `@latest`, promotion is
automatic) of
[`grist-widget-template`](https://github.com/ArthurBlanchon/grist-widget-template)
after every release — see https://gristwidgets.com/docs/contributing/releasing for the full
mechanism. There is no live preview of *unreleased* changes to this
template; to try one locally, scaffold from your working tree with
`pnpm --filter create-grist-widget build` (embeds this template verbatim —
see `scripts/build-template.mjs`) and run the packed CLI against a scratch
directory, same as `scripts/smoke/create-widget.sh` does.

## Deployment

A bundled GitHub Actions workflow (`.github/workflows/deploy.yml`, which runs
the `grist-widget-deploy` command of the `create-grist-widget` devDependency)
publishes this widget to **your own** GitHub Pages. Fixes to the deploy logic
arrive as updates of that devDependency. Next to the widget, every channel
serves `grist-widget.json`, its Grist manifest: name, description, access
level and columns, from the widget's declaration, in the format a
self-hosted Grist's widget list uses.

### The workflow: always develop on `dev`, release by merging to `main`

1. Commit and push to the `dev` branch (created for you at scaffold time).
   Every push auto-deploys a live preview at `/dev/` that self-reloads
   inside an open Grist document a few seconds later — paste that URL into
   a Grist doc once, then just keep pushing while you iterate.
2. Ready to publish a release? On `dev`, run **`pnpm release minor`** (or
   `patch`, or `major`): it bumps `package.json`'s `version`, writes the
   `CHANGELOG.md` entry from what `dev` has that `main` doesn't, and commits.
   Push, then open a PR from `dev` into `main` (the command prints its link).
3. **Merge the PR.** This is the step that actually publishes — merging to
   `main` builds immutable `/v<version>/` and updates mutable `/latest/`.

> ⚠️ **Merging without bumping the version publishes nothing.** The release
> build is idempotent — it skips whenever `package.json`'s version already
> has a matching `v<version>/` directory published, which is always true if
> you forgot to bump it (it'll match whatever's already live). The PR merges
> cleanly and CI runs "successfully," but `/latest/` silently stays exactly
> as it was. Bump the version *before* merging, not after.

After merging, keep committing to the same `dev` branch for your next round
of changes — it's the permanent working/preview branch for this widget, not
a one-off feature branch to delete and recreate. Deleting it retires `/dev/`
automatically.

> ⚠️ **Used GitHub's "Use this template" button instead of `npm create
> grist-widget`?** That path copies this repo's default branch verbatim —
> it doesn't run any of the CLI's own setup (renaming `package.json`,
> titles, etc.), and whatever version happens to be checked into the
> source repo's `package.json` (which can be well past `0.0.1`) comes along
> with it. **The moment the repo is created, GitHub's own initial push to
> `main` fires this workflow and publishes a clean `v0.0.1`** — your first
> release always resolves to `v0.0.1` regardless of what `package.json`
> says, so `/`, `/latest/`, and `/v0.0.1/` all go live right away (once
> you've done the one-time Pages setup below). You don't reset the version
> by hand: on that first release the pipeline also **rewrites
> `package.json`'s version back to `0.0.1` in the repo itself** (a commit it
> pushes to `main`/`dev`), so your *next* release naturally bumps to
> `0.0.2` instead of jumping to whatever inherited number you started with.
> If you also checked **"Include all branches"** (to get `gh-pages`/Pages
> already set up, no manual Settings step), that first release also clears
> out every leftover bit of inherited content it finds — stray
> `v<version>/` dirs, and a root/`latest/` still pointing at the *source*
> repo's own path — before writing its own. A `v<version>/` only counts as
> a genuine prior release once it carries a `showcase-meta.json` naming
> *this* repo, so on a repo with no genuine releases yet, everything else is
> provably inherited noise and gets safely replaced. On that same first
> release, every branch except `main`, `dev`, and `gh-pages` is pruned and
> `dev` is force-reset to match `main`'s tip — a fresh widget always starts
> from `main == dev`, whether it came from the CLI (already true) or a
> template copy (may have inherited a stray branch, or a `dev` full of the
> source template's own unrelated preview history). All of this only ever
> applies before your *first* genuine release — once one exists, it's
> permanently a no-op, so it's still safest to never manually re-seed
> `gh-pages` again after that point.

### Keeping it up to date

`.github/dependabot.yml` opens weekly pull requests against `dev` for your
dependencies (`grist-widget-sdk` included) and the workflows' GitHub Actions,
and `.github/workflows/ci.yml` lints, tests and builds every pull request.
Merge a green one into `dev`, check `/dev/` inside Grist, then release it
like any change (bump the version, merge `dev` into `main`). Changes to the
template's own files (this pipeline, the build config) arrive with
`create-grist-widget`'s updates: after merging one, run
`pnpm exec create-grist-widget upgrade` on `dev` (see
[Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading)).

**One-time setup** (the workflow can't do this part for you):

1. **Settings → Pages** → Source: "Deploy from a branch" → branch `gh-pages`
   → `/ (root)`. The workflow creates the `gh-pages` branch itself the first
   time it runs (if it doesn't exist yet), but Pages needs to be pointed at
   it once.
   > ⚠️ **Not `main`.** If Pages is left on (or accidentally set to) `main`,
   > it serves this repo's raw, unbuilt source — including a script tag
   > pointing at `/src/main.tsx` — instead of the built site. The symptom is
   > a blank/black page with a 404 for `/src/main.tsx` in the browser
   > console, even though the workflow itself reports success (it pushed the
   > right build to `gh-pages`; Pages is just reading from the wrong place).
2. **Settings → Actions → General → Workflow permissions** → "Read and write
   permissions". New repos sometimes default the workflow's token to
   read-only, which would fail the push to `gh-pages` with a 403.
3. If the repo is private, set **Pages visibility to Public** — a widget
   embeds inside a Grist iframe, which needs a publicly reachable URL.
4. **After the first release**, protect the repository, with the
   [GitHub CLI](https://cli.github.com) logged in (`gh auth login`). Not
   before: the first release itself commits to `main` and resets `dev` (see
   above).

   ```bash
   pnpm exec create-grist-widget protect --dry-run   # what it would change
   pnpm exec create-grist-widget protect
   ```

   It creates the rulesets in `.github/rulesets/`, which a template copy
   doesn't get, turns private vulnerability reporting on and checks Pages:
   - `main`: a pull request and the `check` status from `ci.yml`, no force
     push, no deletion. A change then reaches `main` only through a green
     pull request (your `dev` → `main` release PR included).
   - `dev`: no force push, no deletion. Not the pull-request rule: the version
     bump before a release is pushed straight to `dev`.
   - `tags`: no tag moved or deleted.

   Each ruleset file can also be imported by hand: Settings → Rules →
   Rulesets → New ruleset → Import a ruleset. Until they're in place, each
   release warns in its run summary, and the first one opens an issue saying
   so (the workflow's token can read rulesets, not create them).

   An AI agent working on this repo acts through your GitHub account, so
   these rules can't tell it from you. They guarantee the outcome (nothing
   red reaches `main`), whoever merges.

To use the widget, paste its `/latest/` or `/v<version>/` URL into Grist's
custom widget URL field. A self-hosted Grist can also list it in its widget
picker from the `grist-widget.json` each channel serves (see Deployment
above).

