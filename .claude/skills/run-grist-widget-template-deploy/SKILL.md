---
name: run-grist-widget-template-deploy
description: Scaffold a widget via `npm create grist-widget`, push it to a real GitHub repo, and verify the bundled two-channel GitHub Pages deploy pipeline (release + dev channels) actually goes live. Use when asked to run, test, verify, or live-check the grist-widget-sdk deploy workflow, the create-grist-widget CLI's deploy pipeline, or a scaffolded widget's Pages deployment.
---

Drive it via `driver.sh` in this same directory
(`.claude/skills/run-grist-widget-template-deploy/driver.sh`) — it scaffolds
a real widget from the published `create-grist-widget` npm package, pushes
it to a GitHub repo you specify, and polls the resulting public Pages URLs
until both channels come up. This is a **live, real-network, real-repo**
test — not a local dry run (that already exists and is committed at
`scripts/smoke/template-deploy.sh` in the `grist-widget-sdk` monorepo,
which validates the same logic against a local bare git repo with no
GitHub involved — that one's for regression-testing the *code*, this one's
for confirming the actual *product* works end to end).

All paths below assume you're running inside the target repo — a fresh,
empty repo you (or the user) created specifically for this test, with this
skill's two files copied into its `.claude/skills/run-grist-widget-template-deploy/`.

## Prerequisites

1. **A GitHub repo dedicated to this test.** Empty is fine — the driver
   creates its own `main` history. Don't reuse a repo with anything you
   care about; the driver force-pushes as a fallback (see Gotchas).
2. **The Claude GitHub App installed on that repo**, so a Claude Code
   session can be connected to it at all. GitHub → Settings →
   Applications → Installed GitHub Apps → find the Claude app → add this
   repository to its access list. (If you don't see the app listed, an
   org/account admin needs to install it first — Anthropic's app page is
   at `https://github.com/apps/claude`, but the exact settings path
   depends on your GitHub plan/org; a plain personal-repo install is the
   common case.)
3. **`node`/`npm` available** (to run `npm create grist-widget`) and
   **`git`** with push access already configured for the target repo (the
   connected Claude Code session normally has this by default once the
   GitHub App is installed and the repo is added).
4. **No `gh` CLI or `GITHUB_TOKEN` needed.** The driver deliberately avoids
   the GitHub REST API entirely — it only uses `git` (push, and
   `ls-remote` to detect when the workflow's first run creates the
   `gh-pages` branch) and `curl` against public Pages URLs. This was a
   deliberate design choice: this skill was authored from a session that
   only had scoped access to a different repo and no `gh` CLI, so the
   driver had to work without assuming either is available in the session
   that eventually runs it.

## Run (agent path)

```bash
bash .claude/skills/run-grist-widget-template-deploy/driver.sh <widget-name> <git-remote-url>
```

- `<widget-name>` — bare name, lowercase/digits/hyphens only (e.g.
  `live-deploy-check`). This becomes a new directory created in whatever
  directory you run the command from — **run it from the parent
  directory where you want that new project folder to land**, not from
  inside an existing checkout.
- `<git-remote-url>` — the target repo's remote, e.g.
  `https://github.com/<owner>/<repo>.git`.

The script pauses **twice** for a manual GitHub UI step (see Gotchas for
why these can't be scripted) and prints exactly what to click each time:

1. Before the first push: **Settings → Actions → General → Workflow
   permissions → "Read and write permissions."** New repos often default
   to read-only, which makes the deploy workflow's push to `gh-pages` fail
   with a 403 on its very first run — this has to be set *before* that
   first push triggers the workflow.
2. After the workflow's first run creates the `gh-pages` branch:
   **Settings → Pages → Source: "Deploy from a branch" → branch
   `gh-pages`, folder `/ (root)`.** Can only be set once that branch
   exists, which is why this is the second pause, not the first.
   **Not `main`** — found live: leaving (or setting) Pages on `main`
   serves the raw unbuilt source, giving a blank page with a
   `/src/main.tsx` 404 in the console even though the workflow itself
   reports success. If polling below finds a blank/failing page, this
   setting is the first thing to check.

After both, it polls the public URLs and reports:

```
== OK — release + dev channels are both live:
   https://<owner>.github.io/<repo>/v0.0.1/
   https://<owner>.github.io/<repo>/latest/
   https://<owner>.github.io/<repo>/dev/
```

If it exits non-zero instead, the error message names exactly which URL
or branch never came up — check the repo's Actions tab for the failed run.

## Test

Only the fully-local, no-network parts of this are re-checkable directly
in `grist-widget-sdk` (the monorepo this pipeline's source code lives in):

```bash
bash scripts/smoke/template-deploy.sh
```

That's the regression test for the deploy command's (`packages/create-grist-widget/src/deploy.mjs`)
logic (release placement, idempotent skip, dev self-reload injection,
concurrent-push retry, dev removal) against a local bare repo — it does
not touch npm, GitHub, or Pages, so it can't catch the class of problem
this skill's live driver is for (e.g. the published npm package being
stale, or a repo-settings ordering issue).

## Gotchas

- **Why two manual UI steps instead of a fully scripted test.** This
  skill was authored from a Claude Code session scoped to a *different*
  repo (`grist-widget-sdk` itself), which had no `gh` CLI and no GitHub
  MCP tool for changing repo settings (Pages source, Actions default
  permissions) — only tools for PRs/issues/files. Rather than guess at
  raw REST API payloads I couldn't verify from that session, the driver
  uses `read -p` pauses and tells you exactly what to click. If your
  session *does* have `gh` CLI, these two steps can likely be scripted
  with `gh api -X PUT repos/<owner>/<repo>/actions/permissions/workflow -f default_workflow_permissions=write`
  and `gh api -X POST repos/<owner>/<repo>/pages -f "source[branch]=gh-pages" -f "source[path]=/"`
  (untested by me — verify before trusting).
- **Ordering matters for both manual steps.** Workflow permissions must
  be set *before* the first push (it's what the very first workflow run
  needs). Pages source can only be set *after* that run creates
  `gh-pages` (GitHub validates the branch exists when you point Pages at
  it) — setting it before will fail or silently do nothing.
- **The push may need `--force`.** If the repo wasn't created truly empty
  (e.g. GitHub's "Initialize with a README" was left checked), the
  driver's plain `git push -u origin main` will be rejected as
  non-fast-forward; it automatically retries with `--force`. This is only
  safe because this is a designated, disposable test repo — never do this
  against a repo with real history.
- **`npm create grist-widget <name>` wants a bare name, not a path.**
  Passing a full path as the CLI's argument fails validation (its own
  regex only allows lowercase/digits/hyphens) — confirmed by hitting this
  directly while writing the driver. Run the script from the directory
  where the new folder should land.
- **Pages activation lag.** Even after the branch/settings are correct,
  GitHub's Pages CDN can take 30–90 seconds to actually serve content —
  the driver polls every 15s for up to 10 minutes before giving up.
- **`create-grist-widget`'s own npm version matters.** If the live
  package is older than the last change to
  `packages/create-grist-widget/src/deploy.mjs` /
  `.github/workflows/deploy.yml` in the `grist-widget-sdk` monorepo (i.e.
  a changeset for that change was never merged through a "Version
  Packages" PR), this test will scaffold a widget **without** the deploy
  pipeline at all, and every step past scaffolding will fail confusingly.
  If that happens, check
  `https://registry.npmjs.org/create-grist-widget` for the current
  published version before assuming the driver itself is broken.
