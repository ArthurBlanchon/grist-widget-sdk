---
title: Execution plan — 2026-08-09
---

# Execution plan — 2026-08-09

> **Supersedes** `2026-08-08-execution-plan.md` and its two evidence volumes
> (`2026-08-ecosystem-review.md`, `2026-08-agent-readiness-review.md`),
> archived at [`docs/history/`](../history/). That plan's 72 findings and
> 16 batches (A–P) are the reasoning behind everything below; this document
> only restates status and what remains, verified against the actual
> codebase on 2026-08-09 rather than trusted from PR titles.
>
> **15 of 16 batches closed or mostly closed. 2 remain: J, N** (K is blocked
> on J; L and P each have one deliberately-deferred item). No open
> decisions.
>
> **Updates, same day, left in place rather than deleted so the "found it
> open, closed it same session" trail stays visible:**
> - M closed fully (F-03, F-10) — see §2.
> - P substantially executed — see §2. Along the way, wiring up lint
>   surfaced a live dependency-resolution bug (not a lint finding) that
>   broke two other workspace members' builds; see §2's P entry for what
>   happened and how it was caught.

---

## 1. What shipped — verified, not assumed

Every "done" claim below was checked against real code or a real build on
2026-08-09, not inferred from a PR title landing.

| Batch | What it was | Evidence checked |
| --- | --- | --- |
| **A** — truth + template-first | #102 | `grep -r grist-widgets.com apps templates` empty; `.cursor/` gone |
| **B** — agent surface | #104 | `widgets.json` generation script exists; `AGENTS.md`/`CLAUDE.md` ×2 present |
| **C** — template is a real start | #106 | `templates/…/src/App.test.tsx` exists |
| **D** — release self-adopts | #108, #110 | version-guard + canary-cleanup logic present in `deploy.mjs`/`template-canary.yml` |
| **E** — harness → SDK subpath | (shipped pre-F, exact PR unlabeled) | `grist-widget-sdk/emulator/devtools` is a real `package.json` export, built (`dist/emulator/devtools.{js,cjs,d.ts}`) |
| **F** — harness wired into `pnpm dev` | #120 | `template-landing.tsx`/`scaffold-footer.tsx` gone; `LocalDevNotice`/`ReleaseInfo` present |
| **G** — `examples/` is the source of truth | #111 | top-level `examples/` has **17** dirs (plan text says 19 — two were consolidated since; harmless drift, noted so nobody goes looking for a 19th) |
| **H** — CLI engine | #112, #114, #116 | `create`/`init`/`use`/`list` all present in `cli/index.mdx` and match `bin/create-grist-widget.mjs` |
| **I** — docs generate themselves | #118 | `cookbook.mdx`/`cheatsheet.mdx` use `<include>`; `sdk/api/types.mdx` etc. use `AutoTypeTable` |
| **L** — registry robustness | #126 | **partial** — see §2 |
| **M** — site IA and discovery | #127, #128, and this session (5 PRs, unlabeled) | **done** — see §2 |
| **O** — pre-1.0 hardening | #125 (closed/descoped) | `packages/core/tests/docs/` exists and runs |

**Untouched: J, K, N.** P is now mostly done — see §2. See §3.

---

## 2. Batches that closed *mostly*, not *fully* — the part an audit is for

### L · Community registry robustness — partial

- **W-15 (done, verified thoroughly):** `apps/www/lib/registry.ts` validates
  every entry (`parseRegistryWidgets`), rejects non-http(s) `widgetUrl`
  before it ever reaches an `href`. `apps/www/app/widgets/widgets-client.tsx`
  fetches with an `AbortSignal` timeout and one retry, with a real fallback
  UI. This is solid, not a stub.
- **R-01 (screenshots/tags/author):** still absent, but this was L's own
  **explicit non-goal** ("product work — not this batch"), not a miss.
  Still open work, just correctly out of L's scope.
- **R-02 (CLI → registry submission path):** still nothing connects
  "I built a widget" to "list it" beyond a hand-written PR to
  `awesome-grist-widgets`. Not done.
- **R-03 (all seven maintainer repos listed):** **not independently
  verified this pass** — checking `awesome-grist-widgets`' live
  `widgets.json` needs a request this session didn't make. Flag for
  whoever picks this up next: confirm before assuming closed.

### M · Site IA and discovery — closed (was: mostly done, two items open)

- **W-02, W-03, W-04** (nav collision, "Search" ambiguity, playground
  absent from nav) — closed via #127.
- **W-13, F-09** (sitemap/robots/icon/404/OG) — closed via #128; confirmed
  `app/sitemap.ts`, `robots.ts`, `icon.tsx`, `not-found.tsx`,
  `opengraph-image.tsx` all exist.
- **W-10, W-11** ("three competing landing pages" / "17 guide pages, one
  flat list mixing three reading modes") — **closed this session**, not by
  the plan's originally-suggested remedy ("merge `/docs` and `/docs/sdk`
  into one index; unify `/api` and `/design` under Reference") but by a
  different, maintainer-directed one: six sidebar spaces (Quickstart · CLI
  · SDK · Emulator · Registry · Contributing), each with its own scoped
  getting-started page. Verified: `getLayoutTabs()` wired in
  `app/docs/layout.tsx`, six `meta.json` files carry `root: true`, and a
  link-graph audit confirmed no orphaned pages (`quickstart/introduction`
  and six `sdk/guide/*` pages were found unlinked from prose and fixed).
- **F-03** (fumadocs' component library barely used — zero `<Accordion>`,
  `<Files>`, `<Banner>`) — **closed, same session, right after this
  document was first written.** `<Files>` now renders the real scaffold
  tree in `cli/index.mdx`'s "What you get"; `<Accordion>` now wraps
  `contributing/deploy.mdx`'s four Cloudflare error/fix pairs. Deliberately
  *not* `troubleshooting.mdx`, despite looking like the obvious target —
  its 11 H2 symptom headings populate the page's own right-side ToC, and
  its frontmatter description promises "scan headings"; Accordion titles
  aren't real headings, so converting them would have silently dropped
  all 11 from the ToC. `<Banner>` still has zero uses — no genuine fit
  found, not chased just to close the count.
- **F-10** (Tabs/Steps/Callout imported per-page instead of registered once
  in `getMDXComponents`) — **closed, same pass.** `components/mdx.tsx`
  now registers `Tabs`/`Tab`/`Steps`/`Step`/`Accordion`/`Accordions`/
  `File`/`Files`/`Folder` alongside the pre-existing `ExamplesCatalog`/
  `AutoTypeTable`. Every now-redundant per-page import removed (`Callout`'s
  per-page imports were already redundant on their own — `Callout` ships
  in `fumadocs-ui/mdx`'s `defaultMdxComponents` by default; only `Tabs`
  and `Steps` genuinely needed the new registration).

**M's "Done when"** ("Nav reads Examples · Components · Widgets ·
Playground · Docs · GitHub") was never literally met and the plan's own
Phase-4 prose settled on a different, simpler nav during execution — worth
noting as intentional descope, not a gap: the live nav is `Widgets` +
`Docs` (trimmed further this session, since `/docs`'s own six-space
sidebar switcher now makes a duplicate top-level "Examples"/"Components"
entry redundant, not enriching). Recommend closing M's literal Done-when
line rather than chasing a nav shape the plan itself moved past.

### P · Repo and dependency hygiene — substantially done, one item deferred by design

Every item confirmed open in §3 of the prior pass is now addressed:

- **F-11** — `.nvmrc` added (`22`). `packages/core`/`packages/create-grist-widget`'s
  own `engines.node: ">=18"` deliberately left alone — that's their real
  published-package Node-floor commitment, a support-narrowing decision
  hygiene work shouldn't make silently, not the same thing as the
  monorepo's unpinned dev-tooling version F-11 was actually about.
- **F-07** — `.github/dependabot.yml` added: one `npm` entry covering the
  whole pnpm workspace (Dependabot resolves `pnpm-workspace.yaml` natively),
  grouped patch/minor, majors excluded from the group on purpose; plus a
  `github-actions` entry.
- **H-04** — `apps/www/lib/cn.ts` (zero importers) and the `cnfast`
  dependency deleted. `apps/www/README.md` rewritten — it was still
  verbatim `create-fumadocs-app` scaffold output, describing neither this
  repo's routes nor its multi-origin deploy story.
- **T-09** — `templates/…/public/vite.svg` replaced with a real favicon
  (deleting it outright would have 404'd `index.html`'s existing
  reference); `src/assets/react.svg` deleted outright (genuinely
  zero-referenced).
- **A-09** — `.github/pull_request_template.md`, two issue templates, and
  `.github/CODEOWNERS` added.
- **A-10** — `.claude/launch.json` extended to `playground` and the
  template, not just `www`.
- **S-05** — `@vitest/coverage-v8` added to `packages/core`; new
  `test:coverage` script, `v8` provider, `text`+`html` reporters, not part
  of the default `test` run.
- **task-091** — closed properly, not just declared: both packages now
  have a real `eslint.config.js` and a `lint` script, wired into CI
  (`core-ci.yml` gained a `lint` step; a new `create-grist-widget-ci.yml`
  runs lint + test for a package nothing directly CI-checked before —
  only the packed-tarball smoke tests touched it). Turning lint on cold
  surfaced real backlog, closed rather than waved through: a genuinely
  dead `try/catch` in `use-rpc-heartbeat-coalesce.ts` that just rethrew
  (removed, matching the module's own documented "failures aren't
  coalesced" contract); several dead imports; and three deliberate
  `rules-of-hooks` exceptions in `use-grist.ts` and
  `handshake-manager-context.ts` (a structurally-invariant
  provider-vs-standalone branch, not a per-render condition) — each
  given a targeted, documented `eslint-disable` rather than a blanket
  rule-off or a blind restructure of core dispatch logic. Three newer,
  stricter `react-hooks` rules (`refs`, `set-state-in-effect`,
  `immutability` — React Compiler-safety checks this package doesn't opt
  into) are turned off with an explanation in `eslint.config.js`, since
  they flagged ~50 sites across established internal hook patterns that
  need real per-site review, not something to wave through or silently
  fix while wiring up a lint gate.
- **F-12** (components.json alignment) — re-confirmed still aligned
  (`radix-nova`/`neutral` across all three), but still no CI check for
  it — that lint was scoped to J, not P, and stays there.
- **H-03** (root-level planning-doc bloat) — already closed in the prior
  pass, before this document's first version was written: `V1-PLAN.md`
  and `LANDING-DOCS-PLAN.md` archived to `docs/history/`. Noted here only
  so P's own coverage doesn't look incomplete against the archived plan's
  attribution.

**F-08 (major-version convergence) deliberately not done here** — matches
P's own non-goal ("do not converge majors in the same PR as Renovate
onboarding — land the bot first, let it propose"). Dependabot is now live;
convergence follows in its own future PRs, each with its own CI signal.

*Update 2026-10-31:* Vite converged — every workspace is on vite 8 +
@vitejs/plugin-react 6 — in one consolidated dependency PR that superseded
Dependabot's #140–#169 (each major had already run green on its own
Dependabot CI, except the pairs that cannot move apart: plugin-react needs
vite ^8, @eslint/js 10 needs eslint 10). Later the same day a second
consolidated PR (superseding #178–#182) converged TypeScript — every
workspace on TS 6.0, `baseUrl` dropped from the template/playground
tsconfigs (TS 6 deprecates it) — and moved to tsup 9, vitest 5, and
Changesets CLI 3 together with `changesets/action` v2. Still open: TS 7
(ignored in `.github/dependabot.yml`; typescript-eslint does not support it)
and apps/www's eslint, held on 9 until eslint-config-next supports eslint 10.

**A live bug found and fixed, unrelated to any of the above findings.**
Wiring up lint required `pnpm add`-ing new devDependencies into
`packages/core` and `packages/create-grist-widget`, and reinstalling
surfaced two real, reproducible dependency-resolution regressions with
zero connection to lint itself:

1. `apps/www/lib/source.ts` calls zod v4's `ctx.addIssue()` API, but
   `fumadocs-core`/`fumadocs-mdx` declare zod as a peer satisfiable by
   either major — the reinstall flipped their resolution from `4.4.3` to
   `3.25.76`, breaking `pnpm --filter www build` with a type error with
   zero changes to any file under `apps/www`.
2. `packages/core` and the template were both on react `19.2.6` before
   this pass (confirmed against `origin/main`'s own committed lockfile);
   the same reinstall moved `packages/core` to `19.2.8` while the template
   stayed on `19.2.6` — two React copies across the exact boundary where
   the template's tests render hooks that run inside the built SDK,
   producing "Invalid hook call" on every test that mounts a widget.

Both are now pinned in `pnpm-workspace.yaml`'s `overrides` (`zod: ^4.3.6`,
`react`/`react-dom`: `^19.2.8` — converging all four workspace members
that declare react, itself a small, safe piece of F-08 landing early)
with a comment recording exactly what broke and why, so the next person
who watches an unrelated `pnpm install` break a build two workspaces away
isn't starting from zero.

---

## 3. What remains

### J · Grist's config affordance — untouched
**No deps beyond A (done) · ~3 days per original estimate**

`onEditOptions` is plumbed through the SDK's low-level hooks (confirmed:
`packages/core/tests/sdk/public-api.test.ts` does not pin it, so it's
present internally but unexposed on the public surface) but no
`<GristConfigPanel>` exists anywhere in the template. Original scope still
accurate — see the archived plan's own §J for touches/non-goals
(no registry; components.json lint stays a lint, not a CI failure).

One thing to re-check before starting: the archived plan describes
"nine-way duplication" across template/playground (`GristSdkAlerts`,
`GristStatusChip`, `ThemeProvider`) as part of J/H-06's motivation. A
quick grep this pass found `apps/playground/src/components/` no longer
carries `grist-sdk-alerts.tsx` or `grist-status-chip.tsx` equivalents —
only `theme-provider.tsx` is still duplicated. Batch G's "playground
becomes a pure harness" may have organically shrunk this from three files
to one. Worth confirming before scoping J's "one-time pass over the seven
widget repos" line, since the actual duplication surface may be smaller
than the archived plan assumed.

### K · Production-widget essentials (secrets, bundle budget) — blocked on J
**After J**

Unchanged from the archived plan. Document the widget-options-is-not-a-secrets-store
boundary; ship a size budget once `<GristConfigPanel>` (J) exists as the
natural home for a key input.

### N · Landing page and block pages — untouched, softly blocked
**After F (done), G (done), J (not done)**

The homepage today (`app/(home)/page.tsx`, 44 lines) is a single hero + one
CTA to `/docs/quickstart` — closer to W-01's original complaint ("shows
nothing running") than the plan's target ("one live instance with an
example switcher"). `EXAMPLE_DOCUMENT` + the widgets manifest (both landed
in B/G) make the switcher close to free per the plan's own reasoning; the
soft dependency on J is really just "would be nicer with the config panel
to show off," not a hard blocker — worth confirming with whoever scopes
this whether to wait for J or proceed independently.

---

## 4. Recommended next batch

**M and P are both closed (P: substantially — see §2 for the one
deliberately-deferred item).** Next up: **J** — real SDK-surface work
(`onEditOptions` + `<GristConfigPanel>`) that unblocks both K and N.
Re-check the "nine-way duplication" scope per §3's note before starting —
it may be smaller than the archived plan assumed.

---

## 5. `TASKS.md` reconciliation

The archived plan's §9 disposition table flagged two `TASKS.md` entries as
possibly stale.

- `task-092` (release workflow) — already marked `[x]`, with a note it
  shipped stronger than originally scoped (OIDC + Changesets). No edit
  needed.
- `task-091` (lint setup) — **now genuinely done, marked `[x]` in this
  pass.** Its acceptance criteria (`pnpm --filter grist-widget-sdk lint`
  passes; CI gate added) are both true as of Batch P: `packages/core` has
  a real `eslint.config.js` + `lint` script, `core-ci.yml` runs it, and
  `packages/create-grist-widget` got the same treatment plus its own new
  CI workflow, going beyond the literal acceptance criteria's scope.

All other `task-030`–`054`/`task-013` items the archived plan called
"untouched, orthogonal" remain exactly that — SDK-1.0 feature work, not
this plan's concern.
