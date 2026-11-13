# Ecosystem review & plan — 2026-08-08

> **➜ The consolidated, sequenced plan is
> [`2026-08-execution-plan.md`](./2026-08-execution-plan.md)** — 67 findings, 33 PRs, 6
> phases. This file is the evidence behind it.
>
> **Scope:** whole repository, reviewed against one goal — *a junior frontend developer,
> or someone vibe-coding with an AI agent, ships a production-grade Grist custom widget
> and enjoys it.*
>
> **Revised 2026-08-08** after maintainer input: the template repo — not the CLI — is the
> primary entry point in the era of cloud coding agents. See §3. `grist-widgets.com` is
> retired; `gristwidgets.com` (Cloudflare Pages) is canonical and
> `arthurblanchon.github.io/grist-widget-sdk` is the backup origin.
>
> **Reviewed at:** `b96f5ba` · `grist-widget-sdk@0.3.3` · `create-grist-widget@0.3.3`.
> All file references are line-accurate at that commit.
>
> **Volume II** — [`2026-08-agent-readiness-review.md`](./2026-08-agent-readiness-review.md)
> — audits AI-agent readiness and stack-native adoption (Fumadocs, shadcn, Next.js), and
> revises Phases 0/1/3/4/5 below. Read it alongside this one.
>
> **41 findings** across 7 surfaces. Severity: **P0** blocks a credible launch ·
> **P1** changes whether a new user succeeds · **P2** durability · **P3** polish.
> (S-01, S-03, S-04, T-08 — 4 of the original 45 — were reviewed and explicitly
> descoped; see Phase 5 below and `2026-08-execution-plan.md`'s decision log.)

---

## 1. Verdict

Two projects live in this repo, at wildly different maturity levels.

**Shipping at 1.0 quality — the release machine.** npm Trusted Publishing over OIDC with
no stored token. Changesets with a CI gate that fails any PR touching published source
without one. Three external-consumer smoke workflows that pack tarballs and build
*outside* the workspace. A canary that scaffolds from the *published* CLI and deploys it
live every release. Two independent doc origins with correct canonicals. Per-page OG
images, `/llms.txt`, per-page markdown. Almost nothing at 0.3 has this.

**Shipping at 0.3 quality — everything a new user touches.** A landing page that shows
nothing running. A scaffold whose `pnpm dev` renders a marketing page *about the scaffold*
instead of the user's widget. A CLI with no `--help`. Docs that promise features the
template does not contain. Four links to a domain with no DNS record — one of them inside
every widget the CLI generates.

The gap between the two *is* the finding.

---

## 2. The two gaps that matter

### Gap 1 — you cannot see your own widget

`templates/…/src/main.tsx:26-30` routes any non-embedded URL with no channel suffix —
which is exactly `localhost:5173` — to `TemplateLanding`, a 309-line page about the
template itself. Run `npm create grist-widget my-widget && pnpm dev` and you do not see
your widget. You see an ad for the thing you just installed.

To actually watch your code run, the documented path is:

1. Create a GitHub repo and push.
2. Settings → Pages → source `gh-pages` (the workflow creates the branch, but Pages must
   be repointed by hand).
3. Settings → Actions → workflow permissions → read and write.
4. Wait for the deploy.
5. Own or create a Grist document, add a Custom Widget section, paste the URL.

That is the first-run loop for a human. `create-vite`, `create-next-app` and
`npm create astro` all put working output on screen in under thirty seconds — the bar this
audience measures against, whether or not it is fair.

An agent has the same gap with a different shape, and it is worse. A cloud coding agent has
no human watching localhost, so "see it on screen" is not its loop at all — it needs an
assertion it can run headlessly and a URL it can report. The template ships **no tests**, so
the assertion does not exist; and the release rule is "bump the version or the merge
publishes nothing, silently, with CI green." An agent will hit that on its first release,
report success, and be wrong.

**The fix is already in the repo and already published to npm.** `apps/playground` is an
emulator-backed harness where an editable Grist document sits beside a live widget
iframe: a 364-line split-pane shell (`src/pages/home-page.tsx`) and a 636-line document
inspector (`src/components/document-inspector.tsx`), both built entirely on public
subpaths (`grist-widget-sdk/emulator`, `/emulator/devtools`). It runs offline, needs no
Grist account and no GitHub.

It is the most convincing artifact in the project, it is not in the site navigation, and
**the scaffold cannot use it**.

### Gap 2 — the documentation describes a product that does not exist yet

Three examples, all on the first-run path:

- `apps/www/content/docs/cli/index.mdx:28` and
  `apps/www/content/docs/sdk/guide/getting-started.mdx:50` both promise the scaffold ships
  "a vitest setup that imports `renderWithGrist`". The template has **no vitest
  dependency, no `test` script, and no test files**.
- Four docs links point at `grist-widgets.com`, a domain with no DNS record — plus one
  more in `templates/…/README.md:31`, which ships inside *every widget the CLI generates*.
- `cookbook.mdx` states its code is "type-checked when you run
  `pnpm --filter playground build:widgets`". It is a 1,233-line hand-copy of files that
  build step never reads. Same claim, same untruth, in the 1,342-line cheat sheet.

These are the specific claims a careful new user checks first, and each one fails on
contact. A junior developer's trust budget is small and gets spent in the first ten
minutes.

---

## 3. Two front doors, two feedback loops

The unit a cloud coding agent operates on is **a repository**, not a directory. That makes
the template repo — not the CLI — the primary entry point, and it changes what "working"
even means.

Claude Code on the web, Codex, Cursor background agents and Jules all begin by cloning a
repo into a container. `npm create X` assumes a human standing in an empty folder with a
terminal, which is now the minority case for how new projects in this audience start.

The repo already knows this. `quickstart.mdx:88` ships a copy-paste prompt whose entire
content is *how to work around the CLI* — "scaffold into a new subdirectory first, the CLI
refuses a non-empty target directory, and this one already has a `.git` folder." When the
quickstart's happy path is a workaround for your own tool, the tool is in the wrong
position.

And GitHub's **Use this template** with **Include all branches** is the strongest thing in
the current onboarding: it carries `gh-pages` across, so Pages arrives pre-configured and
both manual Settings steps vanish. The CLI structurally cannot do that — it can't create a
repo, so it can't pre-wire Pages.

| | Human path | Agent path |
| --- | --- | --- |
| **Entry** | `npm create grist-widget` in a terminal | **Use this template** → clone into a container |
| **Loop** | dev harness on localhost, judged by eye | `pnpm test`, then the deployed URL |
| **Metric** | 60s to a widget rendering real data | first push yields a live widget and a green suite |
| **Needs** | the emulator harness (Phase 1f) | `AGENTS.md` + a real test (Phase 1b, 1c) |

An agent *can* screenshot localhost — Playwright is available in most of these containers —
but a screenshot it grades itself is a weak signal next to an assertion. The test suite is
the agent's primary loop; the harness is the human's.

> **The single highest-leverage missing file: the template ships no `AGENTS.md`.**
> No `CLAUDE.md`, no `.cursorrules` — the only markdown in it is a 134-line README that is
> ~80% deploy-pipeline internals.
>
> The monorepo has an excellent `AGENTS.md`. The artifact every user actually receives has
> none. Under a template-first strategy that inverts: this one file decides whether the
> first widget an agent writes is idiomatic or garbage — the north-star pattern, the
> no-`window.grist` rule, how to run `renderWithGrist`, that `/dev/` self-reloads, and the
> silent-no-op release rule. It costs a day.

### The CLI is repositioned, not demoted

Its real job was never "make a directory" — it is **parameterization**, which is exactly
what "Use this template" cannot do: rename `package.json`, reset the version to `0.0.1`,
set the title, rewrite `workspace:^` to the published range. That is why
`build-template.mjs` exists, and why the template README carries an enormous warning block
about inherited versions and stray branches.

So: `npx grist-widget init`, run *inside* an existing clone, adopting the repo it is
standing in. That is finding C-04 promoted from bugfix to primary mode — and half the logic
already exists, since `scripts/deploy.mjs`'s first-release path already resets the version,
prunes inherited branches and clears inherited `v*/` dirs. It just runs at deploy time
instead of clone time, and skips the rename. `create` mode stays for the laptop path.

### The risk template-first takes on

If "Use this template" is the front door, **`grist-widget-template`'s `main` branch is now
the product** — and promoting to it is fully manual. `template-canary.yml:23-24` says so in
its own comment: *"This workflow only ever pushes branches; opening/merging that PR is still
a fully manual step."* The canary force-pushes `canary/latest` from a fresh `@latest`
scaffold every release, but nothing merges it.

A forgotten promotion means every new user silently starts on a stale pinned SDK, and no CI
anywhere notices. The CLI never had this failure mode — it resolves a version range at
install time. Automating that promotion (or at minimum a red check when `main` drifts from
`canary/latest`) becomes P0 the moment the template is primary. It is the one place
template-first is genuinely more fragile than CLI-first, and it is cheap to fix.

---

## 4. The harness, and the `add` command

For the human half, one change still carries the most weight: **extract the playground shell
into the SDK, ship it in the template, and make `pnpm dev` open three panes: document,
widget, code.**

- The template stops being a deploy showcase and becomes a development environment.
  ~560 lines of scaffold-meta UI get deleted, not rewritten.
- The 31 `/playground/?url=…` links in the docs stop meaning "go look at ours" and start
  meaning "this runs in your checkout too".
- The landing page finally has something true to show above the fold.
- Writing a test becomes free — the emulator is already mounted — which is what makes the
  agent's loop real, not just the human's.

### And reverse one earlier decision: build the `add` command

`LANDING-DOCS-PLAN.md` settles on "shadcn as inspiration, not architecture — no registry
protocol, no `add` command." For hooks that reasoning is right: `useGrist()` is a
dependency, not a thing you own and edit, and a registry for it would be theatre.

But the cookbook is the counter-evidence. Its ten recipes — `form-edit`, `task-board`,
`attachment-gallery`, `schema-migration` — are 100-300 line multi-file widget shapes that
a user copies wholesale and then rewrites. Owned, opinionated, multi-file, meant to be
edited: that is precisely and only what shadcn's model is for. **The unit of reuse in this
domain is not the hook. It is the widget.**

It also dissolves a defect rather than patching one. If `npx grist-widget add form-edit`
and the cookbook page are both generated from `apps/playground/src/widgets/*`, then 2,575
lines of hand-copied, drift-prone, falsely-labelled documentation stop existing —
generated docs cannot lie about being type-checked.

---

## 5. Findings

### Website — wording, navigation, content (`apps/www`)

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| W-01 | **The landing page shows nothing.** 38 lines: heading, subheading, two buttons. The package is never named, there is no install command, no code, no demo, nothing below the fold. | `app/(home)/page.tsx` | P0 |
| W-02 | **Six flat nav links, four landing inside `/docs`** where the sidebar already covers them: Search · Build · Template · CLI · SDK · Registry. "Build" is also the only verb among five nouns. | `lib/layout.shared.tsx:11-22` | P0 |
| W-03 | **"Search" means three different things.** Nav "Search" opens the widget registry — whose own `<h1>` reads "Widget registry". ⌘K is documentation search. `/docs/registry` is a third page *about* the registry. | `/search`, `/docs/registry` | P0 |
| W-04 | **The playground is absent from nav, landing and footer.** The best asset in the project is reachable only from inline links inside doc pages. | `layout.shared.tsx`, `site-footer.tsx` | P0 |
| W-05 | **"AI-powered tools" is not true.** Nothing here is AI-powered; the tooling is unusually *agent-ready* (`llms.txt`, per-page markdown, `AGENTS.md`). The honest claim is stronger than the inflated one and is the actual differentiator. | `app/(home)/page.tsx:18` | P1 |
| W-06 | **28 of 38 doc pages open by repeating their own description verbatim** — the layout already renders it under the `<h1>`, so every page says the same sentence twice in a row. | measured across `content/docs` | P1 |
| W-07 | **Descriptions are auto-scraped and truncated mid-word** — the cookbook's ends `pnpm --fil...`. Each is reused four times: subtitle, meta description, OG card, `/llms.txt`. An agent reads the truncation as the page summary. | `cookbook.mdx:3` + 12 others | P1 |
| W-08 | **Four links to a domain with no DNS record** (`grist-widgets.com` vs the live `gristwidgets.com`). | `introduction.mdx:86`, `open-questions.mdx:9,172,177` | P1 |
| W-09 | **"Edit on GitHub" 404s on all 38 pages** — the constructed path omits the `apps/www/` prefix. | `app/docs/[[...slug]]/page.tsx:34` | P1 |
| W-10 | **Three competing landing pages.** `/` and `/docs` both act as front doors; `/docs/index.mdx` is 11 lines of cards duplicating the nav; `/docs/sdk/index.mdx` is two adjacent card grids with no prose between them. | `docs/index.mdx`, `sdk/index.mdx` | P1 |
| W-11 | **17 guide pages in one flat list**, mixing three reading modes — concepts, task guides, reference — into a single column. | `sdk/guide/meta.json` | P1 |
| W-12 | **Cookbook + cheat sheet are 2,575 lines — 33% of the whole corpus** — hand-copied from playground widgets, with no mechanism keeping them in sync, both claiming in their opening paragraph to be type-checked. | `cookbook.mdx`, `cheatsheet.mdx` | P1 |
| W-13 | **No sitemap, robots.txt, favicon, custom 404, or OG image for `/` and `/search`.** | no `sitemap.ts`/`robots.ts`/`icon` in `app/` | P2 |
| W-14 | **`/llms.txt` is an unedited flat dump** built from the truncated descriptions in W-07, and is linked from nowhere. For a project whose edge is agent-readiness, that is the wrong file to leave ungroomed. | `app/llms.txt/route.ts` | P2 |
| W-15 | **The registry fetch has no timeout, retry, fallback or schema validation**, and a `widgetUrl` from third-party JSON is rendered straight into an `href`. Rate-limited or offline gives a blank page. | `app/search/search-client.tsx:26` | P2 |

### Template — what every user actually gets (`templates/grist-widget-template-vite`)

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| T-01 | **`pnpm dev` renders the template's own showcase, not the user's widget.** | `src/main.tsx:26-30` | P0 |
| T-02 | **No way to run the widget against data locally.** No emulator harness is shipped, so the only route to real behaviour is deploy → Grist → paste URL. | no emulator import in template | P0 |
| T-03 | **No tests, no vitest, no test script** — while two docs pages promise all three. | `package.json`, zero `*.test.*` | P0 |
| T-10 | **The template ships no `AGENTS.md`, `CLAUDE.md`, or agent instructions of any kind.** The monorepo has an excellent one; the artifact every user receives has none. Under a template-first strategy this is the single highest-leverage missing file — it decides whether an agent's first widget is idiomatic or garbage. | `templates/…` — no agent file | P0 |
| T-04 | **~560 lines of template-meta UI are inherited by every widget** and must be found and deleted by hand: `template-landing` (309), `channel-notice` (125), `showcase-versions` (63), `showcase-routing` (47), `scaffold-footer` (17). | `src/components`, `src/lib` | P1 |
| T-05 | **The starting `App.tsx` is a debug dump** — a collapsible panel printing `JSON.stringify(record)` — rather than the smallest widget worth keeping and editing. | `src/App.tsx` | P1 |
| T-06 | **The README is 134 lines and ~80% deploy-pipeline internals.** "How do I build my widget" gets three bullets. It also carries a dead-domain link, shipped into every scaffold. | `README.md:31` | P1 |
| T-07 | **"Merging without bumping the version publishes nothing."** A silent no-op release, documented with two warning blocks. Tooling should make this unrepresentable, not explain it twice. | `README.md`, `scripts/deploy.mjs` | P2 |
| T-09 | **Default Vite branding left in place** — `vite.svg` as favicon, `react.svg` in assets. | `public/`, `src/assets/` | P3 |

### CLI — the front door (`packages/create-grist-widget`)

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| C-01 | **No `--help`, no `--version`, no flags at all.** The name argument is mandatory, so bare `npm create grist-widget` — what most people type first — exits 1 with a usage line. | `bin/create-grist-widget.mjs:10-13` | P1 |
| C-02 | **Fully non-interactive.** No prompts for the three things every widget must declare — name, required access level, column mappings — even though all three are compile-time constants in the generated `App.tsx`. | whole CLI is 105 lines | P1 |
| C-03 | **Does not install dependencies or detect the package manager**; it prints `pnpm install # or npm/yarn` and stops. | `bin/create-grist-widget.mjs:98-100` | P1 |
| C-04 | **Refuses any non-empty directory — including an empty clone,** because a clone contains `.git`. The documented workaround is a paragraph in the quickstart instructing an AI agent to scaffold into a subdirectory instead. Shipping a prompt to route around your own CLI is a bug report — and since a clone *is* the agent's starting state, this blocks the primary path. | `bin:24`, `quickstart.mdx:88` | P0 |
| C-05 | **One template, no `--template` flag**, while other docs describe HTML and Next.js variants as planned. | `scripts/build-template.mjs` | P2 |

### SDK core (`packages/core`)

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| S-02 | **The `docs` test project points at a directory that does not exist.** `pnpm test` runs it and passes with no tests, so nothing verifies that any documented code sample compiles. This is the mechanism that would have caught W-12. | `vitest.config.ts`, no `tests/docs/` | P1 |
| S-05 | **No coverage measurement or reporting** on a package whose whole pitch is reliability. | `vitest.config.ts` | P3 |

### Playground & registry

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| P-01 | **The widget picker lists raw slugs.** The curated array is empty, so every entry falls back to its id — `v0-minimal`, `reads-demo` — with no title, description or screenshot. | `src/data/widget-examples.ts:32` | P1 |
| P-02 | **Internal regression fixtures are exposed publicly** — `v0-minimal`, `v1-minimal`, `v4-minimal` sit in the same list as real demos. | `src/widgets/` | P1 |
| P-03 | **No code pane.** The document↔widget relationship is demonstrated; the code that creates it is not. The third pane is the half that converts a viewer into a builder. | `src/pages/home-page.tsx` | P1 |
| R-01 | **The registry is four JSON fields fetched client-side.** No screenshots, tags, author, version, or last-updated — nothing that lets someone choose between two widgets, which is the only job a registry has. | `lib/registry.ts` | P1 |
| R-02 | **Nothing connects "I built a widget with your CLI" to "list it".** Submission is a hand-written PR to a different repo plus a README regeneration step. | `docs/registry/index.mdx` | P2 |
| P-04 | **No shareable deep link** from a doc recipe into the playground with that recipe's source open. | 31 links pass only `?url=` | P2 |

### Repository hygiene (root)

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| H-01 | **Two changelogs contradict each other.** Root `CHANGELOG.md` (1,530 lines) still reads "Unreleased — 0.2.0"; changesets publishes from `packages/core/CHANGELOG.md`, now at 0.3.3. `AGENTS.md` and `CONTRIBUTING.md` tell contributors to update the root file; `require-changeset.yml` enforces the other. | `CHANGELOG.md:10` | P1 |
| H-02 | **`ROADMAP.md` is three months and three minor versions stale** — "Progress snapshot (May 2026)", "Package version today: `0.1.0`" — and it and `TASKS.md` link to `/roadmap`, `/tasks`, `/work`, `/changelog`, none of which exist on the site. | `ROADMAP.md:17,30` | P1 |
| H-03 | **137 KB of planning documents sit at the repo root** — `V1-PLAN.md` (66 KB), `LANDING-DOCS-PLAN.md` (44 KB), `TASKS.md` (27 KB), `ROADMAP.md` — and are the first thing a contributor or agent encounters. Most is superseded; `LANDING-DOCS-PLAN.md`'s own P0 findings are still open. | repo root | P2 |
| H-05 | **Promoting the template repo to `main` is fully manual** — the canary force-pushes `canary/latest` from a fresh `@latest` scaffold every release, but nothing merges it. Harmless while the CLI is the front door; the moment "Use this template" is primary, a forgotten promotion silently starts every new user on a stale pinned SDK, and no CI notices. | `template-canary.yml:23-24` | P0 |
| H-04 | **Dead code in the site** — `lib/cn.ts` has no importers, its `cnfast` dependency is unused, and `apps/www/README.md` is still verbatim `create-fumadocs-app` output. | `apps/www` | P3 |

---

## 6. The plan

Six phases. Phase 0 must land first because everything after it is marketing on top of
claims that are currently false. Phase 1 is the bet. Phases 3 and 4 can run in parallel.

### Phase 0 — Stop shipping untrue statements · ~1 week · blocking

No new capability. Every item makes an existing claim match reality — the cheapest
high-leverage work in the repo.

- Delete the vitest promise from `/docs/cli` and `getting-started` (Phase 1 makes it
  true; until then it must not be there). — T-03
- Repoint all five `grist-widgets.com` links (the domain is retired) at `gristwidgets.com`,
  including the one that ships inside every scaffold. — W-08, T-06
- Add the `apps/www/` prefix to the edit-on-GitHub URL. — W-09
- Hand-write all 38 frontmatter descriptions. One edit each fixes the page subtitle, the
  meta description, the OG card and `/llms.txt` simultaneously. — W-06, W-07
- Drop the "type-checked" claim from the cookbook and cheat sheet until Phase 3 makes it
  structurally true. — W-12
- Retire the root `CHANGELOG.md` to a pointer; make `AGENTS.md` and `CONTRIBUTING.md`
  changesets-only. — H-01
- Refresh `ROADMAP.md`'s snapshot and strip links to routes that do not exist. — H-02
- Rewrite the landing copy: name the package, drop "AI-powered", say "agent-ready" and
  mean it. — W-05

**Done when** every factual claim on the first-run path is verifiable in under a minute by
a skeptical reader.

### Phase 1 — Make the first run work, for both doors · 3-4 weeks · the bet

The phase that changes the product. Ordered by leverage, agent path first.

- **1a · Lead with the template repo.** Landing, quickstart and nav put **Use this template**
  (with *Include all branches*) first, CLI second. Mostly IA and copy — it can land in week
  one, ahead of everything below.
- **1b · Ship `AGENTS.md` in the template.** North-star pattern, the no-`window.grist` rule,
  how to run `renderWithGrist`, the `/dev/` self-reload loop, the two Pages settings, and the
  silent-no-op release rule. One day, highest leverage in the plan. — T-10
- **1c · Make the agent's loop headless.** A real `renderWithGrist` test plus a `test` script
  in the template — the only feedback an agent can trust without a human looking, and what
  makes the Phase 0 deletion reversible. — T-03
- **1d · Adoption without manual steps.** Rename, version reset and title applied to a repo
  created from the template — either via `npx grist-widget init` or by extending the
  first-release logic already in `scripts/deploy.mjs`. Deletes the README's warning block.
  — C-04
- **1e · Automate template promotion.** Merge or gate `canary/latest → main`; fail a check
  when they drift. Non-negotiable once the template is the front door. — H-05
- **1f · Ship the dev harness** — extract `apps/playground`'s shell into a public
  `grist-widget-sdk/devtools` subpath and mount it behind `import.meta.env.DEV`, seeded with
  `presets.todoList()`. One branch replaces 560 lines of showcase code. This is the human
  half. — T-01, T-02, T-04
- **1g · A real starting widget** — a mapped-column row editor, the shape most first widgets
  take — and a README rewritten around building rather than deploying. — T-05, T-06

**Two metrics, committed publicly. Human:** scaffold → widget rendering real data → first
meaningful edit in **under 60 seconds**, no GitHub or Grist account. **Agent:** from "Use
this template" to a **live URL and a green suite on the first push**, with no human
intervention.

### Phase 2 — Make the CLI repo-aware · ~2 weeks

Two modes, one binary. `init` adopts the repo it is standing in; `create` keeps the laptop
path.

- **`init` is the primary mode** — run inside an existing clone, it does what "Use this
  template" cannot: rename `package.json`, reset the version, set the title, wire the README.
  Formalises Phase 1d. — C-04
- Prompt when arguments are missing — name, required access, column mappings, install now —
  with every answer also a flag, so agents stay first-class: `--access`, `--columns`,
  `--no-git`, `--no-install`, `--pm`, `--yes`. — C-02
- `--help` and `--version`; a bare invocation prompts instead of erroring. — C-01
- Detect the package manager from `npm_config_user_agent` and install by default. — C-03
- Make the version-bump footgun impossible: fail the release build loudly on an unbumped
  version instead of silently skipping — an agent cannot see a silent no-op. — T-07

**Done when** a developer who types the command wrong, and an agent standing in a fresh
clone, both succeed on the first attempt.

### Phase 3 — Build the widget registry: the `add` command · 3-4 weeks

- **`npx grist-widget add form-edit`**, sourced from `apps/playground/src/widgets/*`. Ten
  recipes already exist there and are already type-checked by `build:widgets`.
- **Generate the cookbook from that registry.** 2,575 hand-copied lines become generated
  pages that cannot drift, each with "Open in playground" and "Add to my widget". — W-12
- **Three-pane block pages** — document · widget · code — with the code pane tracking the
  reader's position. This becomes the landing hero. — P-03, W-01
- **Curate the playground picker**: real titles, one-line descriptions, screenshots; move
  `v*-minimal` fixtures out of the public list. — P-01, P-02
- **Registry v2**: screenshots, tags, author, SDK version, last-updated; validate the feed
  with zod on the consumer side; add a submission path from the CLI. — R-01, R-02, W-15

**Done when** the cookbook has no hand-maintained code and every recipe is one command
away from being in the user's project.

### Phase 4 — Navigation, wording, and the story the site tells · ~2 weeks · parallel to 3

- **Four nav items: Widgets · Playground · Docs · GitHub.** "Widgets" is the registry —
  renaming `/search` ends the three-way collision and frees "search" for ⌘K. "Playground"
  finally surfaces the best asset. "Docs" is one door and the sidebar does the rest.
  — W-02, W-03, W-04
- **Landing page**: the live three-pane harness as the hero, a copyable install command,
  four capability tiles that each link to something running, a registry strip, and
  `/llms.txt` in the footer. — W-01, W-14
- **Docs IA**: restore the five-group guide structure the port flattened (Quickstart ·
  Overview · Concepts · Building widgets · Advanced); merge `/docs` and `/docs/sdk` into
  one index; unify `/api` and `/design` under Reference. — W-10, W-11
- **Wording pass**: one voice, consistent parts of speech in nav, page titles that match
  their `<h1>`, and no promise the tooling does not keep.
- **Discovery surface**: sitemap, robots, favicon, custom 404, OG images for `/` and
  `/search`, and a hand-written header above the generated `/llms.txt`. — W-13, W-14

**Done when** a visitor who lands on `/` knowing nothing about Grist can name what this
is, see it working, and start in one click.

### Phase 5 — Harden the surface before 1.0 freezes it · ongoing

- **Fill `tests/docs/`** so the `docs` project stops being a no-op: extract every fenced
  `tsx` block from the corpus and type-check it in CI. This is what makes "the docs are
  true" permanent rather than a one-time Phase 0 sweep. — S-02 (shipped)
- **Coverage reporting**; move the essay-length workflow comments into
  `/docs/contributing` where they are searchable. — S-05, H-04

**Done when** the public surface a junior sees is small enough to learn in one sitting,
and CI — not review discipline — is what keeps the docs honest.

> S-01 (entry split), S-03/T-08 (self-hosting the plugin-api bridge), and S-04
> (bundle-size budget) were reviewed and explicitly descoped — decided not worth
> pursuing, not deferred. See `2026-08-execution-plan.md`'s decision log.

---

## 7. What to delete

Deletion is most of Phase 0 and Phase 1. These are removals, not rewrites.

| Remove | Size | Why |
| --- | --- | --- |
| `templates/…/src/components/template-landing.tsx`, `channel-notice.tsx`, `scaffold-footer.tsx`, `lib/showcase-*.ts` | ~560 lines | Marketing for the template, inherited by every widget built from it. Replaced by the dev harness. |
| Hand-copied code in `cookbook.mdx` and `cheatsheet.mdx` | 2,575 lines | 33% of the doc corpus, drifting, falsely labelled as type-checked. Generated from the registry in Phase 3. |
| Root `CHANGELOG.md` | 1,530 lines | Superseded by changesets. Currently contradicts the published version. |
| `V1-PLAN.md`, `LANDING-DOCS-PLAN.md`, `TASKS.md` | 137 KB | Move to `docs/planning/` or GitHub issues. Open items graduate to the roadmap; the rest is history. *(This review included — it belongs there too, which is why it lives here.)* |
| `apps/www/lib/cn.ts` + the `cnfast` dependency | 2 lines + 1 dep | No importers. |
| `v0-minimal`, `v1-minimal`, `v4-minimal` from the public picker | 3 entries | Regression fixtures. Keep the widgets, hide them from the catalog. |
| Two of six nav links; `/docs/index.mdx`'s card grid | — | Duplicate what the sidebar and the merged SDK index already cover. |

---

## 8. What not to touch

A plan this heavy on deletion needs to be explicit about the parts that are genuinely
ahead of the field. None of these should absorb any of the effort above.

- **Release engineering.** OIDC trusted publishing, changesets, and a CI gate that fails
  any PR touching published source without a changeset.
- **The emulator.** In-process, transport-accurate, exercising real code paths. It is the
  technical core and it is genuinely good.
- **Smoke & canary workflows.** Packing tarballs and building outside the workspace, plus
  a live canary against the published CLI. This catches the failures that matter.
- **Two-origin doc hosting.** github.io and a custom domain, both complete, one canonical.
  A deliberate answer to enterprise allowlists.
- **The agent surface.** `AGENTS.md`, per-page markdown, copy-as-markdown buttons. Groom
  `/llms.txt`; keep the rest.
- **Design principles & API discipline.** A public-API test pinned to the docs is the
  right instinct. Phase 5 shrinks the surface it guards — it does not remove the guard.

---

## 9. The order matters more than the list

Phase 0 before anything else — a better landing page pointing at claims that are false
converts strangers into disappointed strangers, and that is worse than converting nobody.

Phase 1 before Phases 3 and 4, because both are ways of showing off something that has to
exist first. And *within* Phase 1, the agent-path items (1a-1e) come before the harness (1f)
— not because the harness matters less, but because 1a is copy, 1b is one file, and 1e is a
workflow gate. Three of the five highest-leverage items in this plan are a day's work each;
the harness is three weeks.

If only one thing ever ships, make it **1b**: an `AGENTS.md` in the template. Under a
template-first strategy every widget in the ecosystem is written by an agent reading that
file, and right now it does not exist — so the SDK's conventions, its anti-patterns, and its
one silent-failure release rule reach nobody. It is the cheapest item on this list and the
one with the longest reach.

The uncomfortable summary is that the hardest engineering here is already done and already
published. What is missing is almost entirely a matter of pointing it at the person who
just typed `npm create grist-widget`.
