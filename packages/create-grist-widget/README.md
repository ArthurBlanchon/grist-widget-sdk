# create-grist-widget

Scaffold a new [Grist](https://www.getgrist.com/) custom widget, preconfigured with
[`grist-widget-sdk`](https://www.npmjs.com/package/grist-widget-sdk):

```bash
npm create grist-widget my-widget
cd my-widget
pnpm dev
```

The template ships embedded in this package: nothing is fetched from GitHub
or npm at scaffold time, and the install right after is the only network
access. See [Quickstart](https://gristwidgets.com/docs/quickstart) for the full
walkthrough (dev loop, deploying, embedding in Grist).

Every widget starts from the template, a two-field editor, and the scaffold
installs its own dependencies. For a pattern close to yours (drag and drop,
writes, attachments, a map), read a [catalog widget](https://gristwidgets.com/widgets/):
each has its spec, code and tests in
[`widgets/<slug>/`](https://github.com/ArthurBlanchon/grist-widget-sdk/tree/main/widgets).

## The commands

`create-grist-widget --help` lists them all, with their options:
`create`, `init`, `upgrade`, `demo`, `release`, `protect` and `manifest`.
The [CLI reference](https://gristwidgets.com/docs/cli) shows the same text.

### `init` — starting from an already-initialized directory

`create` refuses a non-empty target directory; `init` is the fix for the case that comes
up constantly with cloud coding agents, which typically start from an already-cloned or
already-`git init`'d repo rather than an empty one:

```bash
mkdir my-widget && cd my-widget
git init   # or: this is already a fresh GitHub Pages / template clone
npx create-grist-widget init
```

Files that already exist and are identical to the template are left untouched; the five
identity-bearing files (`package.json`, `README.md`, `CHANGELOG.md`, `index.html`,
`src/app/App.tsx`) get the usual name/title substitution even if present. Anything else that
already exists **and** differs from the template's own copy stops the run with a list of the
conflicting paths — pass `--force` to overwrite anyway. If `.git` already exists, `init`
never auto-commits; review and commit the result yourself. If it doesn't, `init` sets up
`main` + `dev` and an initial commit exactly like `create` does.

### `upgrade` — picking up template changes

Inside a widget, on `dev` with nothing uncommitted, after updating its `create-grist-widget`
dependency:

```bash
pnpm exec create-grist-widget upgrade
```

It rewrites the template's files (`src/main.tsx`, the workflows, the build configuration) to
this version's copies, deletes the ones earlier templates wrote that are gone now, merges the
template's scripts and dependency versions into `package.json`, and drops pnpm age exceptions
that are old enough not to matter. Nothing of the widget's own is touched (`src/app/` and its
smoke test, `src/components/ui/`, `src/index.css`, `README.md`…). It refuses to
run on `main`, with uncommitted changes, or on a widget still in `src/App.tsx`. Details:
[Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading).

`list`, `use` and `--example` were retired in 0.8: they point to the catalog.

## Using Claude Code?

The scaffolded project ships a working GitHub Pages deploy pipeline
([release + dev channels](https://gristwidgets.com/docs/cli#the-bundled-deploy-pipeline)), which
needs a couple of one-time repo settings that only a human can click through. The
simplest way to get from zero to a deployed widget:

1. Create a new, empty GitHub repo for the widget.
2. Install the [Claude GitHub App](https://github.com/apps/claude) on that repo.
3. Start a Claude Code session connected to it and ask it to scaffold and push:

   ```bash
   npm create grist-widget my-widget
   cd my-widget
   ```

   The scaffold already commits itself on `main` (the branch the deploy
   workflow releases from) with a `dev` branch ready alongside it — no
   separate `git init`/`git commit` needed. Just add the remote and push:

   ```bash
   git remote add origin https://github.com/<owner>/<repo>.git
   git push -u origin main
   git push origin dev   # optional, for the live-preview channel
   ```

4. That push triggers the deploy workflow's first run. Once it completes
   (it creates a `gh-pages` branch), there's **one one-time setting**:
   Settings → Pages → Source → **Deploy from a branch** → branch `gh-pages`,
   folder `/ (root)`. This can only be set once `gh-pages` exists, which is
   why it's a step *after* the first push, not before.

   > ⚠️ **Not `main`.** Pointing Pages at `main` serves this repo's raw,
   > unbuilt source instead of the built site — the symptom is a blank page
   > with a `/src/main.tsx` 404 in the browser console, even though the
   > workflow itself reports success.

   Once that's saved, your widget is live at two URLs:

   - `https://<owner>.github.io/<repo>/latest/` — mutable, always points at
     whatever version was last released.
   - `https://<owner>.github.io/<repo>/v<version>/` — immutable, e.g. `/v0.0.1/`;
     this exact version, forever, even after later releases move `/latest/`.

   Paste whichever one fits into Grist's custom widget URL field — `/latest/`
   if you want the widget to update automatically as you release new
   versions, or a pinned `/v<version>/` if you don't.

   > If the very first workflow run fails with a permissions error pushing
   > to `gh-pages`, your repo's default Actions token permissions are
   > read-only — Settings → Actions → General → Workflow permissions →
   > **Read and write permissions** fixes it. Most repos don't need this;
   > it depends on account/org defaults.

5. **Ongoing workflow: always develop on `dev`, release by merging to `main`.**
   The `dev` branch already exists from step 3. From here on:

   - Commit and push to `dev` for every change. Each push auto-deploys a live
     preview at `https://<owner>.github.io/<repo>/dev/` that self-reloads
     inside an open Grist document a few seconds later.
   - Ready to publish? **Bump `package.json`'s `version`** as part of your
     `dev` changes, then open a PR from `dev` into `main` and merge it —
     merging is what actually publishes (`/v<version>/` + `/latest/`).

   > ⚠️ **Merging without a version bump publishes nothing.** The release
   > build skips whenever the version already has a published `v<version>/`
   > directory, which is always true if you forgot to bump it. Bump the
   > version *before* merging. After your first release, the deploy workflow
   > catches the common case of this and fails the run loudly instead of
   > silently reporting success — but only when it can tell the previous
   > commit had the exact same version; it's a backstop, not a substitute
   > for bumping it yourself.

   Keep committing to the same `dev` branch afterward — it's the permanent
   working/preview branch, not a one-off branch to delete per change.

MIT licensed.
