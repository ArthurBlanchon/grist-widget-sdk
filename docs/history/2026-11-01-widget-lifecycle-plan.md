---
title: Execution plan — 2026-11-01 — a robust widget development cycle
---

# Execution plan — 2026-11-01 — a robust widget development cycle

> **Closed on 2026-11-08.** Every step shipped: the six widgets are
> released (0.1.0), registered as reference widgets, and checked against
> every SDK change; npm publishing is bound to `main`. The one open item,
> the widget repos' rulesets (U5), waits for the core widget library (the
> maintainer's call). What this plan taught stays useful: §2, and the
> standing rules now in the root `AGENTS.md`.
>
> Audience: the maintainer and any agent picking up this work. Scope was
> agreed in chat on 2026-11-01 and **revised on 2026-11-02**, after most of
> it shipped: §1 says where things stand, §2 what executing it taught, §3
> what is left, ranked by what it buys. It runs alongside the 2026-08-09
> plan, whose open batches (J, K, N) it doesn't touch.

**Goal.** An SDK or template change reaches every widget with as little
manual work as possible, a change that would break a real widget shows up
red *before* it is released, and an AI agent can do the routine part of
both safely.

## 0. Principles

1. **Dogfood the user path.** The maintainer's own widgets stay in their own
   repos, scaffolded like anyone else's, and receive every change only
   through what a user has: Dependabot pull requests,
   [Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading) and the
   CLI. A fix a user couldn't make from those is a bug in the template, the
   CLI or the docs, and gets fixed there, not in the widget.
2. **A widget repo holds the widget, plus thin config.** `src/app/` and a
   few widget-owned files; everything shared arrives as a dependency
   (`grist-widget-sdk`, `create-grist-widget`) or through `upgrade`.
3. **Nothing merges unchecked.** Every pull request, Dependabot's included,
   runs lint, test and build.
4. **Supply-chain policies are kept, not bypassed.** pnpm 11's 24 h
   `minimumReleaseAge` and Dependabot's 7-day cooldown stay on; no
   `minimumReleaseAgeExclude` entry is committed to get a check green. The
   one exception is pnpm's own entry for the SDK and CLI versions a scaffold
   is created with (D3).
5. **Least privilege in CI.** Code from dependencies, or from a branch being
   checked, never runs in a job that holds a write token or a secret.
   Permissions are granted per job, not per workflow.
6. **Agents act as the maintainer, so rules guard outcomes, not people**
   (added 2026-11-02). An agent's GitHub actions go through the
   maintainer's account: a branch rule can't tell them apart. So:
   - rules enforce what must hold whoever acts (a PR, a green `check`, no
     force-push), and npm publishing is bound to `main` (U2);
   - what an agent may do is granted in chat. Standing grant: push
     `claude/*` branches, open PRs, and merge its own PRs into a widget's
     `dev` once CI is green on the last commit, then check the deploy.
     Never `main`, never a release, never the SDK repo's PRs;
   - the 24 h age rule makes "release, then use it a day later" the normal
     rhythm. An agent schedules a check-in for that instead of bypassing it.

## 1. Status — 2026-11-08

| Task | State |
| --- | --- |
| U1 · `dependabot-changeset.yml` runs base-branch scripts | done |
| U2 · per-job permissions, `publish-staging` retired | done; environment binding in #216, then the maintainer's settings (§4) |
| U3 · template deploy split into build / publish jobs | done |
| U4 / U4b · lockfile in the first commit, installed with pnpm | done |
| U5 · branch rules on the widget repos | advice for new widgets in #217; the six's rulesets are the maintainer's, after their release (§4) |
| Q1 · the six widgets on `^0.3.20`, Dependabot + `ci.yml` + smoke test | done, merged into `dev` 2026-11-02 (not released) |
| Q2 · status chip removed from the six | done |
| Q4 · stale age exceptions removed; lockfiles committed | done 2026-11-02, no new exception |
| R1 · install URL in the README | done |
| R2 · register the six in `awesome-grist-widgets` | done 2026-11-08 (awesome-grist-widgets #9): the six as `reference` widgets, `pending.json` emptied |
| R3 / R3b · real-widget CI, real Grist | done (#218): the workflow, and `pnpm e2e:grist`, run on each of the six for T3 |
| S1 · deploy as `create-grist-widget`'s `grist-widget-deploy` | done, 0.3.27 |
| S2 · `smokeTestWidget()` | done, 0.3.26 |
| S3 · tsconfig base shipped by the SDK | done, 0.3.25 |
| S4 · `grist-widget-sdk/app`, `mountGristWidget()` | done, 0.3.26 |
| T1 · the widget lives in `src/app/` | done, `create-grist-widget` 0.3.28 |
| T2 · `create-grist-widget upgrade` | done, 0.3.28 |
| T3 · migrate the six | done 2026-11-02, merged into `dev` (not released): create-email-draft#3, news-feed-widget#3, scan-with-ai#3, gantt-widget#6, ask-ai-widget#3, world-map#5 |
| `components.json` widget-owned | #220 merged 2026-11-04; `create-grist-widget` 0.3.30 in Version Packages #221 |
| Release of the six | done 2026-11-08: 0.1.0 for all six (`/v0.1.0/`, `/latest/`, manifests `published: true`); the maintainer let the agent merge these six `dev` → `main` PRs, for this release only |
| The six on `create-grist-widget` 0.3.32, MIT-licensed | done 2026-11-08, merged into `dev`: `pnpm demo`, and each `/dev/` serves its `grist-widget.json` (`published: false`) |
| Reference widgets read from the registry | done (#223): `"reference": true` in awesome-grist-widgets; the six are there since R2. First full Real widgets run in a real Grist on CI, 2026-11-07: all six render |
| `pnpm demo` (step 7) | done, `create-grist-widget` 0.3.31 (#224) |
| Registry of SDK widgets (step 8) | manifest done (0.3.32, #226); registry SDK-only and manifest-based (awesome-grist-widgets #7, #8); `/widgets` shows the manifests (#229). The template repo is listed: MIT license and install URL from the canary (#227), manifest live |

Every release since 0.3.23 was checked end to end (npm, canary, template
repo's `dev` and `main`, both Pages deploys). Local real-Grist runs, 2026-11-02:
all six widgets render inside Grist from their PR builds, before T3 and again
from each T3 pull request's build; each `dev` deploy succeeded after its merge.

## 2. What executing it taught

Each item is a fact found while doing the work, and the rule or fix it led
to. Rules marked *standing* apply to all later work.

- **The template's boundary must be an explicit list.** Real widgets keep
  shadcn registry components where `shadcn add` puts them
  (`src/components/ai-elements/`, `kibo-ui/`) and `GRIST_OPTIONS` in its own
  file. "Everything outside `src/app/` is the template's" would have broken
  them. → `TEMPLATE_FILES` in `upgrade.mjs`, kept equal to the template and
  to the Upgrading page by a test (T1).
- **Thin files that hold widget specifics are the widget's.** world-map's
  smoke test needs a `vi.mock` of maplibre-gl (no WebGL in jsdom), and its
  `tsconfig.app.json` adds `geojson` to `types`. → the smoke test and the
  app/node tsconfigs are widget-owned; what they share lives in the SDK
  (S2, S3).
- **A dry run on a real widget finds what unit tests can't.** Running
  `upgrade` on a copy of world-map found both points above before release.
  → *standing:* a change to the template or CLI is tried on one of the six
  before its PR merges.
- **"Retired" files may still be used.** `public/vite.svg` is index.html's
  favicon in older widgets. → `upgrade` deletes a retired file only when
  nothing refers to it, and names what does.
- **pnpm writes no lockfile on "Already up to date".** With a
  `node_modules` left over and no lockfile, `pnpm install` changes nothing.
  → generate a first lockfile from a clean install
  (`rm -rf node_modules && pnpm install`).
- **Registries and Pages lag about a minute.** npm showed the previous
  `latest` for ~1 min after publishing, GitHub Pages served 404 for a new
  version folder for ~1 min. → checks poll; one 404 right after a deploy is
  not a failure.
- **The smoke scripts share `packages/core/dist`.** Run concurrently, one
  rebuilt the SDK under the other. → *standing:* run them one at a time
  locally (CI runs them in separate jobs).
- **Merging `main` into a stacked branch can duplicate a section**
  (`-X ours` did, in the Upgrading page). → after such a merge, diff the
  tree against the branch's previous tip before pushing.
- **The agent can't see some settings** (environments, secrets) through its
  GitHub access. → those stay in §4 as maintainer actions, verified by the
  maintainer.
- **Old widgets rendered only on a channel path.** Their pre-S4 `main.tsx`
  showed the template landing page at `/`, the widget only at `/<repo>/dev/`
  and the like. T3 removed it: `mountGristWidget()` renders the widget at
  any path inside Grist.
- **`components.json` is the widget's.** gantt-widget keeps its `@kibo-ui`
  registry there, and `upgrade` reset `registries` to `{}`, which breaks
  `shadcn add @kibo-ui/...`. The dry run on world-map couldn't show it:
  world-map has no registry. → `components.json` left `TEMPLATE_FILES`
  (a `create-grist-widget` patch); gantt's T3 PR put the entry back by hand.
- **What an old `main.tsx` put around `<App />` is the widget's.** ask-ai
  wrapped it in `TooltipProvider`, world-map loaded it with `lazy()`, and
  `mountGristWidget()` knows neither. → each moved into `src/app/App.tsx`
  in a commit before `upgrade`. world-map's `App.tsx` lazy-loads
  `WorldMap.tsx` and re-exports `WIDGET_METADATA` from `grist-options.ts`,
  so the main chunk doesn't pull the map in. Two widgets also passed
  `unavailableGraceMs={4000}`; they now get the default 5 s.
  *Standing:* before `upgrade` rewrites an older widget's `main.tsx`,
  compare it with the template's and move what is the widget's into
  `src/app/`.
- **A template update can bring new lint rules.** ESLint 10's recommended
  set added `no-useless-assignment`, which failed on a component ask-ai
  installed from a registry. → fixed in the widget; `pnpm lint` stays part
  of the routine after every `upgrade`.
- **`CHANGESET_PUSH_TOKEN` is not set.** The Version Packages PR is pushed
  with `GITHUB_TOKEN`, so its runs wait as `action_required` until someone
  reruns them (the agent did, for #219). → §4.

## 3. What is left, in order

Ranked by what each step buys for this project: six widgets, one
maintainer, agents doing the routine work.

1. **T3 · migrate the six: done** 2026-11-02, one PR per widget merged
   into `dev` (§1). Each followed the Upgrading page: the move into
   `src/app/`, `create-grist-widget` as a dev dependency, `upgrade`, the
   smoke test as one `smokeTestWidget()` call (world-map keeps its
   maplibre mock), `upgrade` again, then typecheck, lint, test, build and
   `pnpm e2e:grist`. What it found is in §2.
2. **Release the six, last** (maintainer; decided 2026-11-04). The six are
   released once, when the rest of this work is done, not after each step.
   Until then every change lands on `dev`, and `/dev/` is where they are
   tried in Grist.
   - **Before it,** each widget takes the latest `create-grist-widget` on
     `dev`, 0.3.30 at least (`components.json`): once that version is a day
     old, `pnpm add -D create-grist-widget@^<version>`,
     `pnpm exec create-grist-widget upgrade`, `pnpm install`, the checks;
     one PR per widget, merged into `dev` (principle 6).
   - **The release:** check each `/dev/` in Grist, bump `version` on `dev`,
     merge `dev` → `main`. One release per widget covers everything since
     its last one. Step 3 (R2) and step 4's U5 come after it.
3. **R2 · register the six** in `awesome-grist-widgets`, each marked
   `"reference": true`, then empty `scripts/real-widgets/pending.json`.
   Their install URL and MIT license reach `main` with the release, which
   the registry's rules require.
4. **Close the security loose ends.** Small, and they back principle 6:
   - **U5:** a ruleset on each widget repo, set after its first release
     (which commits to `main` and resets `dev` itself). `main`: require a
     PR and the `check` status, block force pushes and deletion. `dev`:
     block force pushes and deletion only, since the release's version
     bump is pushed straight to it, and the `dev` → `main` PR is checked
     anyway (`ci.yml` runs on every PR). New widgets get the same advice in
     the template's README and `AGENTS.md` (#217).
   - **U2's environment:** `release.yml`'s release job declares
     `environment: npm` (#216); the maintainer restricts that environment
     to `main` and sets it on both packages' npm trusted publishers. An
     agent pushes branches, and this is what stops a modified workflow on a
     branch from publishing.
   - **The stale `next` dist-tag** (maintainer, §4).
5. **R3 · one "real widgets" workflow, informational.** The last safety
   net that's missing: an SDK change that breaks a real widget is found
   before release, not by the widget's next Dependabot run.
   - **The list** is a small file in this repo naming the six repos. It is
     the allowlist; reading the registry waits until widgets by other
     authors are in scope, a separate decision.
   - **On a PR touching `packages/core` or `packages/create-grist-widget`**,
     and weekly: for each widget, check out `dev`, point
     `grist-widget-sdk` and `create-grist-widget` at the packed tarballs
     (no age check for `file:`), run `typecheck`, `test`, `build`. On a
     failure, rerun against the published versions and report it as a
     regression only if those pass. Lint stays out. `pull_request` only,
     `permissions: {}`, no secrets, no cache; the summary records each
     widget's SHA.
   - **R3b, real Grist, weekly and on demand only** (not on PRs: about
     30 s and a Docker service per widget): the same list, each widget's
     build embedded in Grist from a **pinned** Docker image, in a document
     generated from its `GRIST_OPTIONS` (typed columns, a sample row, the
     access it requests, every column mapped, linked when it reads the
     selected row). It passes when the widget renders past `GristBoundary`
     with no JavaScript error except from services the widget calls itself;
     screenshots are kept as artifacts. The same script runs locally as
     `pnpm e2e:grist <widget dir>`. It checks the emulator rather than
     replacing it: passing in the emulator but failing in Grist is an
     emulator parity bug, fixed in the SDK.
6. **Write the agent's routine down where agents read it.**
   - The template's `AGENTS.md` (which `upgrade` keeps current in every
     widget): when Dependabot's `create-grist-widget` update is merged into
     `dev`, run `pnpm exec create-grist-widget upgrade` in a follow-up PR.
     That replaces T4. Done in #217.
   - This plan's §2 standing rules are in the root `AGENTS.md` ("Changing
     the template or the CLI"), so they outlive the plan. Done after T3.
7. **`pnpm demo`: done** (2026-11-06; `create-grist-widget demo`, the
   template's `demo` script). Originally: **optional, last: `pnpm demo`** in a widget, on R3b's script: a pinned
   Grist in Docker with a generated document and the widget's dev server
   embedded, a real local demo with no account. Docker stays optional:
   never needed for `dev`, `test` or the deploy. A shared demo stays a
   public docs.getgrist.com document embedding the widget's `/latest/`.

8. **A registry of SDK widgets, described by their own manifests**
   (decided 2026-11-07). Every widget built with the SDK publishes what it
   declares; the registry lists only such widgets and shows it.
   1. **The manifest:** `create-grist-widget manifest`, run by the deploy
      workflow's build job, writes `grist-widget.json` on every channel. It
      is a Grist custom widget entry (`ICustomWidget`, the format of
      `GRIST_WIDGET_LIST_URL` lists: checked against grist-core 1.7.22's
      `WidgetRepository`, and a list of the six manifests showed in a real
      Grist's widget gallery), plus a `gristWidgetSdk` key. Widgets get it
      with `upgrade`, and publish it from their next deploy.
   2. **The registry, SDK widgets only: done** (awesome-grist-widgets #7,
      #8). The four other widgets left. `registry.json` holds two URLs per
      widget; `scripts/build.mjs` reads each manifest at its install URL
      (a release build naming the entry's repository) and writes the
      README, `widgets.json` and `grist-widgets.json`, Grist's widget-list
      format, committed and read through raw URLs: no publishing step. The
      template repo is the first entry.
   3. **gristwidgets.com/widgets: done** (2026-11-07). It shows each
      manifest, read live from the install URL: access, columns, version,
      license, SDK version, the reference badge; the registry docs page
      explains it, and `GRIST_WIDGET_LIST_URL`.
   4. **R2** registers the six through it, after their release, and the
      template repo `grist-widget-template` too: the canary gives it the MIT
      license and its install URL on every refresh, and it serves a
      manifest from the first canary after the release that ships
      `manifest`. Not a `reference` widget: the smoke scripts already check
      the template before every release.

   Later, its own project: an AI-built catalogue of widgets on the SDK.

**Dropped or deferred**, and why:

- **T4 (a scheduled workflow running `upgrade` in each widget): dropped.**
  It would run the CLI, dependency code, in a job that pushes, against
  principle 5, to save one command a release. Step 6 covers it.
- **R4 (R3 as a required check): deferred.** With six widgets and one
  maintainer, an informational report read before merging is enough.
  Revisit if a regression ever ships past it.
- **R3 reads the registry's reference widgets** (decided 2026-11-06): one
  list, curated by the maintainer through the `reference` mark; widgets by
  other authors only when the maintainer marks them.
- **Not now:** a Vite plugin preset (it would tie the SDK to Vite majors)
  and a shared ESLint config (the most volatile area; Dependabot and
  `ci.yml` already cover it).

## 4. Maintainer-only actions

- **U5: deferred** (2026-11-08) until the core widget library exists: the
  rulesets in step 4, in each widget repo's settings.
- **U2: done 2026-11-08.** The `npm` environment accepts `main` only, both
  packages' npm trusted publishers name it (direct publish allowed, dist-tag
  management not), and both disallow tokens.
- **The stale `next` dist-tag: removed** 2026-11-08.
- **`CHANGESET_PUSH_TOKEN`: set** (2026-11-07): Version Packages PRs run
  their checks on their own.
- **Releases** of the widgets (`dev` → `main`) and of the SDK (merging the
  Version Packages PR) stay the maintainer's. The six's 0.1.0 is the one
  exception: the agent merged it, with the maintainer's leave for that
  release only.

## 5. Decisions recorded

- **Widgets stay external** rather than moving into this monorepo. The
  standalone path is the product, and it is what surfaced every problem in
  §2.
- **The status chip is removed** (#194). Connection state shows only when
  something is wrong.
- **The `next` snapshot channel is dropped,** with the manual `-rc.N` flow.
- **TypeScript 7 stays ignored** in the template's Dependabot until
  typescript-eslint supports it.
- **S1 — the deploy command lives in `create-grist-widget`,** not a new
  package: it is already published over OIDC, versioned with the SDK, and
  its changelog records template changes.
- **S4 — the chrome carries self-contained styles** reading shadcn's CSS
  variables with neutral fallbacks; the alert rendering stays overridable.
  Inside Grist the widget follows Grist's light/dark theme.
- **T1 — the template's files are an explicit list;** everything else is
  the widget's, the smoke test and the app/node tsconfigs included.
- **T3 — `components.json` is the widget's** (2026-11-02): it holds the
  registries `shadcn add` installs from, so `upgrade` leaves it alone.
- **T2 — `upgrade` raises dependencies, never lowers or removes them,**
  deletes a retired file only when nothing refers to it, and doesn't
  install.
- **2026-11-02 — agents merge into widget `dev` only** (principle 6), T4
  dropped, R4 deferred, R3's widget list is a file in this repo, R3b and
  `pnpm demo` share one script.
- **2026-11-04 — the six are released once, at the end** of this work
  (maintainer). Nothing goes to a widget's `main` before; `dev` and its
  `/dev/` preview carry every change until then, R2 and U5 follow the
  release.
- **2026-11-07 — the registry lists SDK widgets only,** each described by
  the `grist-widget.json` it deploys, in Grist's widget-list format. The
  four other widgets leave it.
- **D1 — `publish-staging` is retired** (U2). It was the only path that
  published from a branch other than `main`. Pre-release testing goes
  through R3, or through a packed tarball.
- **D2 — the "no UI styles" principle is extended** for S4's chrome, in
  `sdk/design/principles.mdx`: chrome around the widget only, appearance
  always overridable, never inside the widget's own content.
- **D3 — a scaffold made within 24 h of a release keeps pnpm's own
  exception** for the SDK and CLI versions it was made with. Once the
  lockfile pins a version less than 24 h old, pnpm refuses local installs
  too unless that entry stays, so dropping it would break `pnpm dev` on
  release day. It only covers the versions released with the CLI being
  run; `upgrade` prunes it once expired. This is the one stated exception
  to principle 4.
