# Execution plan — 2026-08-08

> **This is the plan.** Evidence lives in
> [Volume I — ecosystem review](./2026-08-ecosystem-review.md) and
> [Volume II — agent-readiness & stack leverage](./2026-08-agent-readiness-review.md).
> How it got to this shape is in the [decision log](#appendix--decision-log) at the bottom.
>
> **72 findings · 16 merge batches · ~6 week critical path · no open decisions.**

**Packed for execution.** §1 is sixteen merge-sized batches rather than a long PR list: each is one
coherent deliverable an agent can hold in context and prove with a command, and one a human can
review as a single idea. Every batch carries **Non-goals** — the field agents most need, because
without it an agent that notices adjacent drift will fix it and a six-file PR becomes sixty.

**The bet, in one paragraph.** The template repo is the front door, because a cloud coding agent
operates on a repository, not a directory. Cloning it gives you the boilerplate; one command gives
you a starting example; the example carries its own access level, column mappings, seed document
and test, so it works and proves itself immediately. Everything below either makes that true or
stops something from contradicting it.

---

## 1. The work, packed into merge units

Fifteen batches, not thirty-five PRs. Each is one coherent deliverable an agent can hold in
context, finish, and prove with a command — and one a human can review as a single idea. The
original PR ids are retained per batch so §7's coverage still resolves.

Every batch carries **Non-goals** deliberately. It is the field agents most need and plans most
often omit: without it an agent that notices adjacent drift will fix it, and a 6-file PR becomes a
60-file PR that nobody can review.

---

### A · Make every claim true, and lead with the template
**No deps · large diff, trivial review · absorbs 0.1–0.4, 1.1 · W-05→09, W-12ᵃ, T-03ᵃ, T-06ᵃ, F-06, A-01, A-02, A-06, H-01, H-02, H-07, F-02**

**Goal.** Nothing in the repo asserts something that is not so, and the front door points at the template.
**Touches.** `apps/www/content/docs/**` (38 frontmatter blocks), `apps/www/lib/source.ts`, `apps/www/app/docs/[[...slug]]/page.tsx:34`, `apps/www/app/(home)/page.tsx`, `.cursor/rules/` (delete), `AGENTS.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `ROADMAP.md`, `TASKS.md`, three `package.json`.
**Reuse.** `pageSchema` is already imported in `lib/source.ts` — add a zod refinement, don't replace it.
**Non-goals.** Do **not** touch `cookbook.mdx`/`cheatsheet.mdx` code blocks (that is I). Do not restructure nav (that is M). Do not write the new `AGENTS.md` content (that is B) — only fix the two stale statements in the existing one.
**Done when.** `pnpm --filter www build` green; `grep -r "grist-widgets.com" apps templates` empty; the zod refinement fails the build if any description is duplicated or over-length.

### B · The agent surface
**After A · ~3 days · absorbs 1.2, 1.3, 1.4 · P-04, T-10, A-03, A-04, A-07, A-01ᵖ**

**Goal.** An agent opening either repo knows what to do, and the file telling it cannot go stale.
**Touches.** new `scripts/build-widgets-manifest.mjs`, `AGENTS.md` ×2 (root + template), `CLAUDE.md` ×2 (one line each: `@AGENTS.md`), new lint in CI.
**Reuse.** **Import, do not parse** — `await import()` returns `GRIST_OPTIONS`/`WIDGET_METADATA`/`EXAMPLE_DOCUMENT` already type-validated. One regex for `@/components/ui/*` only.
**Non-goals.** No `GEMINI.md`, no `copilot-instructions.md`, no generator, no drift-check between vendor files — the standard converged (§0). Do not move the examples yet (that is G); read them where they are.
**Done when.** `widgets.json` emits for all 19; the lint fails when `AGENTS.md` names a script or path that does not exist.

### C · The template becomes a real starting point
**After A · ~2 days · absorbs 1.5, 1.9 · T-03, T-05, T-06**

**Goal.** A scaffold ships a widget worth keeping and a test that proves it.
**Touches.** `templates/…/src/App.tsx`, new `templates/…/src/App.test.tsx`, `templates/…/package.json` (vitest devDep + `test` script), `templates/…/README.md`.
**Reuse.** `renderWithGrist` + `presets` from `grist-widget-sdk/emulator/testing` already work headlessly — no harness needed.
**Non-goals.** Do **not** delete `channel-notice.tsx` or `showcase-versions.ts` — the release-info card is kept (see F). Do not touch `main.tsx` (that is F).
**Done when.** A fresh scaffold runs `pnpm test` green.

### D · The release pipeline self-adopts
**After A · ~2 days · absorbs 1.6, 1.7 · C-04ᵃ, H-05**

**Goal.** "Use this template" produces a correctly-named repo with no manual steps, and `main` cannot go stale.
**Touches.** `templates/…/scripts/deploy.mjs` (first-release path only), `.github/workflows/template-canary.yml`.
**Reuse.** The first-release guard already exists — extend inside it so idempotence is preserved by construction.
**Non-goals.** Do not change the two-channel model or `gh-pages` layout. Do not touch the version-bump behaviour (that is H).
**Done when.** `bash scripts/smoke/template-deploy.sh` green; `canary/latest` deleted; a canary run force-pushes `main` and asserts `gh-pages` exists.

### E · Extract the harness into the SDK
**After A · ~2 weeks · absorbs 1.8a · T-01, T-02**

**Goal.** `grist-widget-sdk/devtools` is a public, documented subpath.
**Touches.** `packages/core/src/emulator/devtools/**`, `packages/core/tsup.config.ts`, `packages/core/package.json` exports, `packages/core/tests/sdk/public-api.test.ts`.
**Reuse.** `apps/playground/src/pages/home-page.tsx` (364 lines) and `components/document-inspector.tsx` (636) already build on public emulator APIs — this is a move, not a rewrite.
**Non-goals.** Do not wire it into the template (that is F). Do not change the emulator's own API.
**Done when.** `public-api.test.ts` covers the new subpath; the playground consumes it from the package rather than locally.

### F · Wire the harness into `pnpm dev`
**After E, C · ~1 week · absorbs 1.8b · T-04**

**Goal.** `pnpm dev` shows the user's widget with matching data, offline.
**Touches.** `templates/…/src/main.tsx`, delete `template-landing.tsx` + `scaffold-footer.tsx` (~326 lines), rename `channel-notice`/`showcase-versions` → `release-info`, shrink `showcase-routing` to channel detection only.
**Reuse.** `import.meta.env.DEV` replaces URL-shape parsing. Import the harness via `await import("grist-widget-sdk/devtools")` **inside** the DEV branch, so elimination follows from the module graph rather than dead-code analysis.
**Non-goals.** Do not delete the release-info card. Do not touch the deploy workflow.
**Done when.** `pnpm dev` renders the widget seeded from `EXAMPLE_DOCUMENT`; the production build contains no emulator symbol (three-line grep in the smoke build).

### G · `examples/` becomes the source of truth
**After A · ~1 week · absorbs 3.1 · P-01, P-02**

**Goal.** One place holds the examples; the playground becomes a pure harness.
**Touches.** new `examples/**` (moved from `apps/playground/src/widgets/`), delete `widget.html`, `widget-entry.tsx`, `discovery.ts`, `data/widget-examples.ts`, `data/document-examples.ts`; `scripts/build-site.mjs` (third target); `scripts/smoke/create-widget.sh`.
**Reuse.** The playground's `?url=` already normalises absolute URLs — point the iframe at deployed examples.
**Non-goals.** Do not restructure the example files themselves (§3 specifies contents). Do not add `EXAMPLE_DOCUMENT` to all 19 — only where derived columns are insufficient.
**Done when.** `site/examples/<name>/` deploys for every example; the smoke test builds each against the packed SDK tarball.

### H · The CLI engine
**After B, D, G · ~2 weeks · absorbs 2.1–2.3 · C-01→C-05, A-05, T-07**

**Goal.** `create`, `init`, `use`, `list` — one engine, offline.
**Touches.** `packages/create-grist-widget/bin/`, `scripts/build-template.mjs` (embed `examples/`), `templates/…/scripts/deploy.mjs` (version guard).
**Reuse.** The compose step is the same function as `use` — write it once for all three call sites (§3). `@clack/prompts` for prompting.
**Non-goals.** No `--template` flag. No network at `use` time. Do not touch `src/main.tsx`, `vite.config.ts` or the workflow when switching — blast radius is the example's files plus additive ui.
**Done when.** Smoke test exercises all four verbs; **the git gate has its own test** — it rests on the CLI's `git init`, which a future `--no-git` would silently remove.

### I · Documentation generates itself
**After G · ~1 week · absorbs 3.2, 3.3 · W-12, F-04, F-05**

**Goal.** No hand-maintained code in the docs.
**Touches.** `apps/www/lib/source.ts` (add `remark-directive`), `cookbook.mdx`, `cheatsheet.mdx`, `apps/www/content/docs/sdk/api/**`, `apps/www/package.json` (+`fumadocs-typescript`).
**Non-goals.** Do not rewrite the prose around the code — only replace the fenced blocks with `<include>`.
**Done when.** `cookbook.mdx` + `cheatsheet.mdx` drop from 2,575 lines to prose only; `pnpm --filter www build` green.

### J · Grist's config affordance, and closing the duplication
**After A · ~3 days · absorbs 3.5, 3.6 · S-07, F-12, H-06**

**Goal.** Widgets get Grist's native settings panel, and the nine-way duplication stops growing.
**Touches.** new `<GristConfigPanel>` in `templates/…/src/components/`, `packages/core/tests/sdk/public-api.test.ts` (pin `onEditOptions`), a `components.json` alignment lint, and a one-time pass over the seven widget repos.
**Reuse.** `onEditOptions` is **already plumbed** through the SDK's low-level hooks — it is absent from the public surface test and unexposed, not missing. Ship the component in the template alongside the other five shared files.
**Non-goals.** **No registry.** New scaffolds already receive the five duplicated files *from the template*, so the only unserved case is updating seven repos the maintainer owns — a one-time chore, not a product feature. Building `registry.json` + `shadcn build` + a `/r/` route + cross-environment proof for that is premature, and it would reopen the origin decision. Revisit when batch L's community registry carries entries from people other than the maintainer: then "how do I get the update" is a real question from a stranger and a registry is the right answer. The `components.json` check stays a **lint, not a build failure**.
**Done when.** A widget declaring `onEditOptions` shows Grist's *Open configuration* entry and renders the panel; the seven repos carry current copies of the five files.

### K · What a production widget needs beyond the SDK
**After J · ~3 days · absorbs 3.7 · S-06, T-11**

**Goal.** Secrets and bundle weight have documented answers.
**Touches.** `apps/www/content/docs/sdk/guide/`, template `AGENTS.md`, template `package.json` (size budget).
**Reuse.** `<GristConfigPanel>` from J is where a key input belongs.
**Non-goals.** Do not build a secrets *service*. Document the boundary — widget options live in the document and are readable by anyone with document access — and ship a typed helper only if it earns its place.
**Done when.** A widget author asking "where does my API key go?" finds an answer in one page.

### L · Community registry robustness
**No deps · ~2 days · absorbs 3.4 · W-15, R-01, R-02, R-03**

**Goal.** The `/widgets` list cannot blank out, and the seven shipped widget repos are reconnected.
**Touches.** `apps/www/app/search/search-client.tsx`, `apps/www/lib/registry.ts`, the `awesome-grist-widgets` entries.
**Non-goals.** Screenshots, tags and author metadata are product work — not this batch.
**Done when.** Offline or rate-limited renders a useful fallback; all seven repos are listed.

### M · Site IA and discovery
**After A · ~1 week · absorbs 4.1, 4.4, 4.5 · W-02, W-03, W-04, W-10, W-11, W-13, F-09, F-03, F-10**

**Goal.** The nav names what this project has, and the site is discoverable.
**Touches.** `lib/layout.shared.tsx`, `content/docs/**/meta.json`, `app/sitemap.ts`, `robots.ts`, `icon.tsx`, `not-found.tsx`, `opengraph-image.tsx`, `components/mdx.tsx`.
**Non-goals.** Not the landing page (that is N).
**Done when.** Nav reads Examples · Components · Widgets · Playground · Docs · GitHub; all five file-convention files exist.

### N · The landing page and block pages
**After F, G, J · ~1.5 weeks · absorbs 4.2, 4.3 · W-01, W-14, P-03**

**Goal.** `/` shows one live instance with an example switcher; recipes get document · widget · code.
**Reuse.** B's manifest and `EXAMPLE_DOCUMENT` make the switcher nearly free — the list and each document are already derived.
**Non-goals.** No thumbnail grid, no screenshot pipeline (§4.2 reasoning).
**Done when.** A visitor can name what this is, see it running, and start in one click.

### O · Pre-1.0 hardening — closed
**After I · absorbed 5.1 · S-02**

Shipped as `tests/docs/`: 5.1/S-02 only — every fenced `tsx` block in the docs corpus is now
extracted and type-checked in CI, closing the `docs` vitest project's no-op gap (found three real
doc-sample bugs on its first clean run). 5.2/S-01 (the entry split), 5.3/S-04 (bundle-size budget),
and 5.4/S-03+T-08 (self-hosting the plugin-api bridge) were reviewed and explicitly descoped — see
the decision log.

### P · Repo and dependency hygiene
**No deps · continuous · absorbs 5.5–5.7 · F-07, F-08, F-11, S-05, H-03, H-04, T-09, A-09, A-10**

**Goal.** Staying current has a mechanism, and the repo stops carrying dead weight.
**Non-goals.** Do not converge majors in the same PR as Renovate onboarding — land the bot first, let it propose.
**Done when.** One TypeScript, one Vite, one React major across four workspaces; `.nvmrc` present; PR/issue templates exist.

---

## 2. Sequencing

```
A ──┬── B ──┬── H
    ├── C ──┴── F ── N
    ├── D ─────────┘
    ├── E ── F
    ├── G ──┬── I ── O (closed)
    │       └── H, N
    ├── J ──┬── K
    │       └── N
    └── M
L, P — no dependencies, run whenever
```

**Week 1:** A alone (blocking).
**Weeks 2–3:** B, C, D, G, J, M in parallel — six independent batches, and B+C+D+G is the whole
agent-first outcome. E starts now too and runs long.
**Weeks 4–5:** H, I, K, F.
**Week 6:** N. P continues after (O closed early — see §1).

Critical path is **A → E → F → N ≈ 6 weeks**; everything else fits inside it. If only weeks 1–3
ship, the agent path is complete and the human path is unchanged — that is the intended failure
mode.

---

## 3. What an example is

**Content only — never a full project.** Nineteen complete scaffolds would mean nineteen copies of
`package.json`, `vite.config.ts`, `index.html`, `main.tsx`, `tsconfig*.json` and `components.json`,
so every boilerplate change — 1.8's harness, say — becomes nineteen edits. That is the cookbook
failure mode industrialised. It would also break `use`, which is safe precisely because it copies
one directory rather than merging two projects.

```
examples/form-edit/
├── WidgetApp.tsx        GRIST_OPTIONS · WIDGET_METADATA · EXAMPLE_DOCUMENT? · the component
└── WidgetApp.test.tsx   optional — travels with the example, so `use X` yields a green suite for X
```

**No `example.json`.** The instinct is to add one; do not. Access level and columns are in
`GRIST_OPTIONS`, title and description in `WIDGET_METADATA`, ui dependencies in the import
statements. A metadata file would be a second source of truth that can disagree with the code.

Two properties make this work, both verified across all 19 examples:

- **The host contract is three exports, identical in both existing shells.** The playground's
  `widget-entry.tsx` and the template's `main.tsx` differ only in how they *find* the widget; both
  wrap it in `GristWidgetProvider → GristBoundary → GristSdkAlerts`.
- **No example imports anything outside `grist-widget-sdk`, `@/components/ui/*` and `react`.** So
  an example drops into the template needing no dependency the template lacks beyond ui
  primitives, which the manifest tracks.

### `EXAMPLE_DOCUMENT` — the demo's data, in the same file

`presets` already return plain typed `GristReplicaDocument` data, so an example can name the
document it should be seen with. Optional: when absent, derive one from `GRIST_OPTIONS.columns`,
which carry name and type. Only examples needing plausible values — `form-edit`'s `Priority`,
`contacts` — declare it explicitly.

Three consumers: the playground harness (picking an example loads its document, so `form-edit` can
no longer be shown against `blank` and render nothing), the example's own test, and 1.8's dev
harness. It does **not** serve the deployed `site/examples/<name>/` build — a deployed widget runs
in real Grist against the user's own document — and it is tree-shaken out of production, because
only the `import.meta.env.DEV` branch references it.

This retires `apps/playground/src/data/document-examples.ts` and most of `public/templates/*`; the
standalone picker can stay for open-ended exploration.

> **Residual trade-off, recorded.** An earlier proposal shipped all examples *inside* the template
> so any of them could be run offline from a fresh clone. This plan ships them in the CLI package
> instead, so `list` and `use` are still fully offline — what you lose is browsing all 19 in your
> editor without running `use` first. That is a much smaller loss than it first appeared, but it is
> a real difference, and reversing it is a one-line change to `build-template.mjs` if browsing ever
> matters more than a scaffold with nothing to delete.

### Composition is the same function as `use`

Deploying an example standalone and smoke-testing it both need a full project, so both *compose*
one — and that is the `use` operation with a different destination:

| Call site | Destination |
| --- | --- |
| `npx grist-widget use X` | the user's repo |
| `build-site.mjs` | temp dir → `site/examples/<name>/` |
| `scripts/smoke/create-widget.sh` | temp dir → built against the packed SDK tarball |

One function, three call sites — the same pattern `build-template.mjs` already uses, where the
template lives once and is composed at pack time. Writing `use` gives the deploy pipeline and the
smoke proof for free.

---

## 4. What has to work in all three template environments

The template exists in three forms, and anything it ships must work in all of them: **(a)** the
monorepo workspace member, **(b)** the npm tarball `build-template.mjs` produces, **(c)** the
canary clone scaffolded from the published CLI.

With no registry, the thing that travels is not a URL but the **examples themselves**, embedded
into the npm package by the same script that already embeds the template. Nothing is fetched, so
nothing can be blocked, rate-limited or rot.

Two properties still need holding, both cheap:

1. **`components.json` must stay identical across the three apps.** Verified today — same
   `style: radix-nova`, same `baseColor: neutral`, same five aliases; only `rsc` and the CSS path
   differ, correctly. It matters because examples declare `@/components/ui/*` imports that the CLI
   resolves with `shadcn add`, which generates against the consuming project's style. A three-way
   sync check is a few lines and belongs in CI — a future `shadcn add` in one app can rewrite its
   own `components.json` and nothing would notice.
2. **Every example must build against the *published* SDK, not workspace source.** The monorepo
   cannot prove this: it resolves `workspace:^`. `scripts/smoke/create-widget.sh` already scaffolds
   from a packed tarball outside the workspace — extending it to compose and build each example is
   the guarantee the whole examples story rests on.

The template vendors five ui primitives against the playground's twelve, so an example needing
`table` or `scroll-area` pulls them in on `use` — correct behaviour, driven by the manifest.

---

## 5. Decisions — both closed

**Registry origin — closed, twice over.** It was closed by dropping the widget registry (examples
are embedded in the CLI package, so `use` fetches nothing). It briefly reopened when a component
registry was proposed for the five duplicated files, then closed again when that was deferred: new
scaffolds already receive those files from the template, so the only unserved case is updating seven
repos the maintainer owns. **Nothing in this plan fetches from a registry, so no origin needs
choosing.** If a component registry is ever built — the trigger is third-party widgets needing
updates — the recommendation is a single canonical origin with the fallback documented in the
template's `AGENTS.md`, since adding a namespace later is additive and removing one is breaking.

**Is the template repo authored or generated? — generated.** `main` is force-pushed from a fresh
`@latest` scaffold every release; `canary/latest` is deleted. The repo is a distribution artifact,
not a project.

---

## 6. Cut, with reasons

- **The shadcn registry, entirely — reasoned twice.** For widgets, because they are exclusive
  rather than composable and `use` beats `add` on every axis: offline, atomic on the contract file,
  git-gated. For the five duplicated components, because the template already delivers them to new
  scaffolds, leaving only seven maintainer-owned repos to update by hand — infrastructure for a
  one-time chore. Deferred with an explicit trigger (§J) rather than rejected. F-01 is closed as
  *deliberately not adopted*. Note this was reversed once mid-plan on a 9× duplication count, then
  re-closed on the observation that the count changed the severity of the drift without changing
  who it affects.
- **The golden-task agent eval.** Needed API keys, nondeterministic, flaky by construction.
  Replaced by 1.4's keyless lint, which catches the same failure mode.
- **A Skill shipped in the template.** Vendor-specific config in every generated repo, for a task
  `AGENTS.md` covers in one line.
- **Hand-grooming `llms.txt`.** Ahrefs' 137K-site study found ~97% are never read and targeted
  fetches are ~0.1% of AI-bot traffic; the one niche where it works is docs sites feeding coding
  assistants, which is this audience. So keep the route Fumadocs generates for free, link it, and
  maintain nothing on top of it.
- **Any hosted MCP server.** Fumadocs and `mcp-handler` both need a server runtime; `apps/www` is
  `output: export`. GitHub Pages cannot run it and Cloudflare Functions can, which would give one
  origin a capability the other lacks and break the two-origin completeness invariant.
  **What this costs, stated plainly:** Volume II identified three agent audiences, and the third —
  agents that never clone the repo and answer "how do I do X with this SDK" from anywhere — was
  the one MCP would have served. It is now served only by `/llms.txt` and per-page
  `/llms.mdx/**/content.md`, both generated and both fetchable by any agent with web access. That
  is thinner than a queryable server, and it is a deliberate trade against introducing a runtime to
  a fully static site. Revisit if the site stops being static, or on evidence that agents fail to
  find things.
- **`canary/latest`** and **`widget.html?id=`** — both existed to serve mechanisms that no longer
  exist.
- **`--template` plumbing.** Replaced by `--example`, which has a real list behind it.

---

## 7. Coverage

All 72 findings, mapped to the PR that closes them (4 — S-01, S-03, S-04, T-08 — mapped to
"descoped": reviewed and explicitly decided not worth pursuing, not deferred).

| Surface | Findings → PR |
| --- | --- |
| **Website · 15** | W-01→4.2 · W-02→4.1 · W-03→4.1 · W-04→4.1 · W-05→0.1 · W-06→0.1 · W-07→0.1 · W-08→0.1 · W-09→0.1 · W-10→4.1 · W-11→4.1 · W-12→0.1+3.2 · W-13→4.4 · W-14→4.2 · W-15→3.4 |
| **Template · 11** | **T-11→3.7** · T-01→1.8 · T-02→1.8 · T-03→0.1+1.5 · T-04→1.8 · T-05→1.9 · T-06→0.1+1.9 · T-07→2.3 · T-08→descoped · T-09→5.6 · T-10→1.3 |
| **CLI · 5** | C-01→2.2 · C-02→2.2 · C-03→2.2 · C-04→1.6+2.1 · C-05→2.1 |
| **SDK · 7** | **S-06→3.7** · **S-07→3.6** · S-01→descoped · S-02→5.1 · S-03→descoped · S-04→descoped · S-05→5.6 |
| **Playground · 4** | P-01→3.1 · P-02→3.1 · P-03→4.3 · P-04→1.2 |
| **Registry · 3** | R-01→3.4 · R-02→3.4 · **R-03→3.4** |
| **Hygiene · 7** | H-01→0.3 · H-02→0.3 · H-03→5.6 · H-04→5.6 · H-05→1.7 · H-06→3.5 · **H-07→0.3** |
| **Agent surface · 10** | A-01→0.2+1.4 · A-02→0.2 · A-03→1.3 · A-04→1.3 · A-05→2.1 · A-06→0.2 · A-07→1.3 · A-08→cut · A-09→5.7 · A-10→5.7 |
| **Stack · 12** | F-01→closed, not adopted · F-02→0.4 · F-03→4.5 · F-04→3.2 · F-05→3.3 · F-06→0.1 · F-07→5.5 · F-08→5.5 · F-09→4.4 · F-10→4.5 · F-11→5.5 · **F-12→3.5** |

> **Two findings are new**, surfaced in discussion rather than in either volume. **H-06:**
> `GristSdkAlerts`, `GristStatusChip` and `ThemeProvider` are duplicated between template and
> playground with a written hand-sync instruction in the README — guaranteed drift. **F-12:** the
> three `components.json` files must stay aligned on `style`/`baseColor` or a recipe renders
> differently in a scaffold than in the playground, and nothing checks it. **H-07:** `TASKS.md`
> carries 19 non-done tasks that no document reconciles against this plan (§9). A later fresh pass
> over the seven deleted production widgets added three more — **S-06** (no secrets story),
> **T-11** (no widget bundle budget) and **R-03** (the shipped widget repos are orphaned), plus **S-07** (Grist's native config-panel
> affordance is plumbed but unsurfaced) — and
> upgraded H-06 from three files to five in nine places. 65 + 7 = 72.

---

## 8. If you only do three things

**0.2 — delete the Cursor rule.** Half an hour. It is `alwaysApply: true` and it instructs every
Cursor agent to read a deleted directory and to work in a way CI rejects. Cursor reads `AGENTS.md`
natively, so deletion is the whole fix. Everything else built for agents sits on top of this.

**1.2 + 1.3 + 1.5 — the manifest, both `AGENTS.md` files, and the template's first test.** Three
days together, and that is the agent-first bet in its entirety: the manifest makes the example
table generated instead of guessed, `AGENTS.md` is what every agent reads before writing a line,
and the test is the only feedback an agent can trust without a human looking.

**2.1 — the example engine.** `create --example`, `init --example`, `use`, `list`, offline. This is
what turns "clone the template" from one fixed starting point into a real choice a user and an
agent can make *after* they know what they are building — and revise later without losing work.

---

## 9. What this plan does *not* supersede

`TASKS.md` is a parallel backlog aimed at **SDK 1.0**, where this plan is aimed at **ecosystem
usability**. They overlap but are not the same, and a reader working only from this document would
silently drop eleven live items. PR 0.3 reconciles them; the disposition is:

| `TASKS.md` item | Disposition here |
| --- | --- |
| `task-051` Bundle-size budget | **Absorbed** → 5.3 |
| `task-040` Reorg playground by Guide page | **Superseded** → 3.1 strips the playground to a harness instead |
| `task-041` Cross-link Guide → playground | **Superseded** → 3.2's `<include>` and the deployed example URLs |
| `task-050` Close every open question | **Adjacent** → 0.3's doc reconciliation touches the same files |
| `task-092` GitHub Actions release workflow | **Already done** in reality (`release.yml` ships); stale entry |
| `task-091` Lint setup | **Likely stale** — `eslint.config.*` exists in every app; verify and close |
| `task-030`–`034` replica/schema work | **Untouched.** Milestone-0.5 SDK features, orthogonal to this plan |
| `task-052` Peer-dep widening | **Untouched.** Belongs with 5.2's pre-1.0 surface work |
| `task-053` Error-message audit | **Untouched.** Genuinely valuable and genuinely out of scope here |
| `task-054` `MIGRATION.md` | **Untouched.** Only needed if 5.2 breaks anything |
| `task-013` Emulator parity audit | **Untouched.** Roadmap 0.8, explicitly not a 1.0 blocker |

The honest summary: this plan owns the *first-run and agent surfaces*; `TASKS.md` owns the *SDK
feature surface*. Both are real. Neither should be deleted in favour of the other, and 0.3 should
make that relationship explicit at the top of `TASKS.md` rather than leaving two documents that
each look authoritative.

---

## 10. The target architecture, reviewed

A junior arriving here knows shadcn, Next.js and Vite, and nothing about Grist. An agent arriving
here knows the same. This section is the end-state judged against that, not against the backlog.

### What they actually meet

```
grist-widget-template  ──clone──►  a Vite + React + TS + Tailwind + shadcn app
                                   with CI and Pages already wired
        │
        └─ npx grist-widget use form-edit   ──►  src/App.tsx + its test
        └─ pnpm dev                          ──►  document │ widget │ code, seeded
        └─ pnpm test                         ──►  green
        └─ git push                          ──►  a live URL
```

Every one of those four commands is one a Vite user already knows. Nothing in the loop is
Grist-specific except the word `grist` in one command. That is the bar, and it is met.

### The four ideas a junior has to learn

Not zero — Grist is a real system — but the plan holds it to four, all visible in one file:

```tsx
export const GRIST_OPTIONS = {
  requiredAccess: "full",                        // 1. widgets ask for access
  columns: [{ name: "Title", type: "Text" }],    // 2. the user maps your names to their columns
}
export const EXAMPLE_DOCUMENT = presets.todoList()  // 3. a document is the widget's other half
export default function WidgetApp() {
  const w = useGrist()                              // 4. one hook, all state
}
```

That is the whole mental model, and it is the same file they edit, the same file `use` swaps, the
same file the manifest reads, and the same file the docs transclude. **One artifact, five roles.**
When a junior asks "where do I change the access level", the answer is "the file you are already
in" — which is the property that makes the rest of the design hold together rather than a lucky
convenience.

### Where it is elegant

- **The contract is the file.** `main.tsx` importing `GRIST_OPTIONS` from `App.tsx` is why `use`
  is a copy rather than a migration, why switching cannot desynchronise access level from code,
  and why the manifest can be *derived* rather than authored. One structural decision pays for
  three mechanisms.
- **One function, three call sites.** `use`, the deploy build, and the smoke test are the same
  compose operation. Writing the user-facing feature buys the pipeline and the proof.
- **Derived over declared, everywhere.** No `example.json`, no hand-written example table, no
  registry manifest, no curated picker. Adding a directory makes it appear in `AGENTS.md`, the
  CLI, the docs and the playground. Nothing to forget.
- **The plan deletes more than it adds.** 560 lines of showcase UI, 2,575 lines of hand-copied
  cookbook, a Cursor rule, `canary/latest`, `widget.html?id=`, `discovery.ts`, a registry that was
  never built. Net negative lines for a plan that adds a CLI, a harness and a manifest.

### Where it is still fragile — re-judged

*Are the fixes really necessary? One is, one I over-corrected, and one resolves itself.*

**The `@/components/ui/*` coupling — real, but I over-corrected the fix.** An example declares
`import { Button } from "@/components/ui/button"`, so that path must mean the same thing in three
places. But style drift changes *appearance*, not correctness — a scaffold with a different
`baseColor` still builds and still works. Failing the build for that is too heavy. **Downgrade to a
lint**, and let the real guarantee come from the smoke test that already scaffolds and builds:
after `use X`, the scaffold must compile. Correctness gated, appearance reported.

**`import.meta.env.DEV` — keep the check, but make it a backstop rather than the mechanism.** The
failure is silent and permanent: ship the emulator once and every widget carries it forever. The
elegant form is not "assert absence" but "make presence impossible" — import the harness only via a
dynamic `await import("grist-widget-sdk/devtools")` *inside* the DEV branch, so Rollup emits a
separate chunk a production build never references. Elimination then follows from the module graph
rather than from dead-code analysis of a static import, and 1.8's assertion becomes a three-line
backstop in the smoke build.

**Two shells — this one resolves itself, and I missed that.** After 3.1 the playground stops
rendering widgets entirely: its iframe points at deployed example URLs, so `widget-entry.tsx` and
`discovery.ts` are deleted. One shell remains, the template's `main.tsx`. No work needed — the
fragility was an artefact of reading 3.1 as a move rather than a deletion.

### The judgement, plainly

For a junior: the loop is four familiar commands and the mental model is four ideas in one file.
For an agent: `list` returns structured options, `use` is atomic and git-gated, `pnpm test` is the
verification, and `AGENTS.md` — lint-checked — is the instruction. Both audiences get the *same*
artifacts, which is why neither can drift away from the other.

The design's core bet is that **the widget contract living in one file** is strong enough to
carry the CLI, the manifest, the docs and the demo. That bet is sound because the property already
exists in the codebase and is verified across all 19 examples — this plan exploits it rather than
introducing it.

---

## Appendix — decision log

Four review passes reshaped this plan. Recorded because the reasoning matters more than the
outcome, and because two of the passes reversed earlier conclusions of mine.

**Pass 1 — verifying assumptions.** Fumadocs `<include>` is real (needs `remark-directive`, and
`apps/www` has no remark config today). `fumadocs-typescript` v5 ships `AutoTypeTable`. The
`AGENTS.md` standard converged — Codex, Cursor, Copilot, Gemini CLI, Jules, Windsurf, Zed and Devin
read it natively, so the planned generator, CI drift check, `GEMINI.md` and `copilot-instructions.md`
all evaporated in favour of a one-line `CLAUDE.md` pointer. Corrected a dependency error of mine,
and took the dev harness off the critical path once it became clear `renderWithGrist` + `presets`
already work headlessly, cutting ~9 weeks to ~6.

**Pass 2 — simplest and most on-the-shelf.** Removed the golden-task eval (API keys,
nondeterministic) for a keyless lint. Kept `llms.txt` as a generated route but cut all grooming,
on the evidence. Removed `shadcn` from `package.json` rather than pinning it. Cut the template
Skill. Adopted `@clack/prompts` instead of hand-rolling prompts (a companion decision to adopt
`npx shadcn build` was reversed in pass 4, when the registry went). Shrank 5.1 once it
became downstream of the cookbook transclusion.

**Pass 3 — the template repo's purpose.** Clarified as a dev preview plus a copyable pre-wired
boilerplate, i.e. a distribution artifact rather than a project — which settled the authored /
generated question and deleted `canary/latest`, since it existed only as a PR source for a manual
promotion that no longer happens.

**Pass 4 — examples, not components.** Widgets are exclusive, not composable: one `requiredAccess`,
one column contract, one behavior, and nobody adds two. So the operation is "start from", not
"add", and `shadcn add` was the wrong verb — the registry is dropped entirely. What makes switching
safe is that `main.tsx` imports `GRIST_OPTIONS` from `App.tsx`, so the whole contract travels in
one file and a swap is atomic. That plus the CLI's existing `git init` gives a real safety gate.
Examples move to a root directory with four consumers and one source, and the compose step turns
out to be the same function as `use`.

**Pass 5 — closing Batch O early.** After 5.1/S-02 shipped (`tests/docs/`, the doc-sample
type-checker), 5.2/S-01 (the ~91→~20 entry split), 5.3/S-04 (bundle-size budget in CI), and
5.4/S-03+T-08 (self-hosting the plugin-api bridge) were reviewed and explicitly decided against —
not deferred, not reprioritized, just not being done. Batch O is closed; §7's coverage table marks
all three "descoped" rather than pointing at a batch letter that no longer has work behind it.

**Corrections carried forward.** Two attributions were wrong and are fixed above: killing the
cookbook drift belongs to 3.2's `<include>`, not to any registry; and shrinking the 91-export
surface is a win for humans and token budget, not for agents. Counts were also miscounted twice
(43/45 for findings, 31 for PRs); the sets were never wrong, only the arithmetic.
