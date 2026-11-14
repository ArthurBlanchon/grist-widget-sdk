# Documentation rewrite plan — 2026-11-14

> **Status: proposed.** Revised the same day: the maintainer is the only
> user for now, so the docs describe the current API only, with no
> deprecated forms, migration tables or "before and after" anywhere. Part of the [plan to 1.0](./2026-11-14-review-and-1.0-plan.md):
> 1.0 promises a stable surface, and the docs are how people meet it. The
> rewrite runs after 0.7.0 (step C) and before 1.0.0 (step F), alongside the
> widgets' catch-up (steps A and E).

Scope: the docs site (`apps/www/content/docs/`, 41 pages, about 30,000
words), judged by one question: *how fast does a professional engineer go
from nothing to a released, tested widget, and find any answer after
that?* Evidence is from the pages as of `main` after #26.

## 1. Findings

### 1.1 The docs teach the 0.4 way of writing a widget (P1)

The template, the examples and the SDK moved to one declaration
(`defineGristWidget()`, `widget.useGrist()`, `mappedRecord`) in 0.5. The
guides didn't follow. Outside the pages about migrating:

| Old form still taught | Pages |
| --- | --- |
| `GRIST_OPTIONS` instead of `defineGristWidget()` | 16 |
| `useGrist<Row, Mapped>()` generics | 7 |
| `w.record` (raw ids) instead of `mappedRecord` | 10 |
| a manual `columnMappingStatus` check the boundary already makes | 7 |
| `GristWidgetProvider options={…}` by hand | 7 |

The *Typing* page is about "the two generics on `useGrist()`", which
`defineGristWidget()` removed. The quickstart's first snippet prints
`w.record?.id`. These still compile, so the snippet type check doesn't
catch them: a reader copies 0.4 code from the 0.7 docs.

### 1.2 Mixed audiences, overlapping entry points (P1)

- **Four front doors:** `quickstart/index`, `quickstart/introduction`,
  `quickstart/concepts` and `sdk/index` each explain what a widget is and
  how to start, in different words.
- **Maintainer pages in the user's navigation:** *Contributing* (deploy
  2,047 words, releasing 1,483) narrates the project's history ("found
  live", "used to", "retired on"), useful to maintainers, noise to users.
  The same goes for *Design* (`principles`, 1,418 words; `open-questions`;
  `replica-document`).
- **Long pages:** `cli/index` is 2,571 words: scaffolding, every command,
  the deploy pipeline and repository settings on one page.
- **Overlap:** `cheatsheet`, `cookbook`, `examples` and the API pages show the
  same shapes in four places.

### 1.3 Nothing keeps the reference true (P2)

The API reference (`sdk/api/*`, 4,500 words) is written by hand, next to an
API report (`packages/core/api/*.api.md`) that CI now keeps exact, and a
`fumadocs-typescript` type-table generator the site already uses on one
page. The CLI reference repeats `--help` by hand. Moved pages have no
redirects (the site is a static export on two origins).

### 1.4 What is good and stays

- Code samples are type-checked in CI (`extract-doc-snippets.mjs`).
- `examples/` is the canonical widget source, and each example runs in a
  real Grist at `/examples/<id>/demo/`.
- `/llms.txt`, `/llms-full.txt` and per-page Markdown for agents.
- *Troubleshooting* is symptom-first. *Versioning policy*, *Deprecated
  names*, *Upgrading* and *Releasing* are recent and current.

## 2. Principles for the rewrite

1. **One way to write a widget, everywhere:** `defineGristWidget()`,
   `widget.useGrist()`, `mappedRecord`, `updateRecord`/`addRecord`,
   `renderWithGrist(<App />, { widget, rows })`. Older forms appear nowhere:
   no deprecated names, migration tables or "before and after" (the
   changelog keeps the history).
2. **Four kinds of page, never mixed** (Diátaxis): a tutorial that teaches
   by doing, guides that answer one task each, a reference that is complete
   and dry, and a few explanations of how and why.
3. **Generated where it can be:** the API reference from the code's types
   and TSDoc, the CLI reference from the CLI's own help, the example gallery
   from `widgets.json`. A hand-written page explains; it doesn't list.
4. **Short pages:** one question each, about 800 words at most. A page that
   needs more is two pages.
5. **Examples are quoted, not pasted:** a page shows an example's code by
   including it from `examples/` (as the cookbook already links), so it
   can't drift. Once `examples/` merges into the catalog
   ([widget factory plan](./2026-11-14-widget-factory-plan.md), W2), the
   source is a catalog widget, a docs snippet that CI type-checks, or a
   test fixture, and a CI check makes sure every public name has one.
6. **Users first:** maintainer material leaves the site for the repository,
   organised for the AI agents that do the development (§3.1).
7. **Three audiences, AI-first** ([widget factory plan](./2026-11-14-widget-factory-plan.md) §9).
   Each one has its own part of the docs:
   - people using widgets in Grist, often no-code: the catalog, generated
     from each widget's `SPEC.md`;
   - people building outside the factory: the tutorial, guides, the
     reference, the template's `AGENTS.md`, skills and `llms.txt`;
   - the factory itself: the docs in the repository (§3.1).

   For the second, machine-readable contracts (`llms.txt`, per-page
   markdown, the API report, skills) come before prose: they are what an
   agent reads.

## 3. Target structure

About 25 user pages, against 41 today.

| Section | Page | Kind | From |
| --- | --- | --- | --- |
| **Get started** | Overview: what a widget is, what the SDK does, when to use the raw plugin API | Explanation | `index`, `quickstart/introduction`, `sdk/index` (intro), `raw-plugin-api-vs-sdk` |
| | Your first widget: scaffold, declare columns, read, write, test, see it in real Grist, release, protect | Tutorial | `quickstart/index`, `sdk/index`, `cli/index` (scaffold part) |
| | Examples: the gallery, from `widgets.json` | Reference | `quickstart/examples`, `cookbook` |
| **Guides** | Declare and map columns | Guide | `column-mapping`, `typing` |
| | Read data | Guide | `reading-data` |
| | Write data | Guide | `writing-data` |
| | Attachments and REST | Guide | `attachments-and-rest` |
| | Widget options | Guide | `widget-options` |
| | Linking and theme | Guide | `linking-and-theme` |
| | Errors and alerts | Guide | `error-handling` |
| | Test a widget | Guide | `emulator/index`, `emulator/testing` |
| | Keep it fast | Guide | `performance` |
| | Deploy and embed | Guide | `cli/index` (deploy pipeline, embedding) |
| | Release a widget | Guide | `cli/releasing` |
| | Upgrade a widget (the commands only: Dependabot, `upgrade`, checks) | Guide | `cli/upgrading`, without its migration tables |
| | Protect the repository | Guide | `cli/index` (repository settings) |
| | List a widget in the registry | Guide | `registry/index` |
| | Troubleshooting | Guide | `troubleshooting` |
| **Reference** | `grist-widget-sdk` (and `/app`, `/actions`) | Reference, generated | `sdk/api/index`, `use-grist`, `use-grist-schema`, `provider-boundary`, `app`, `helpers`, `types` |
| | `grist-widget-sdk/emulator` and `/emulator/testing` | Reference, generated | `emulator/api` |
| | `create-grist-widget` commands | Reference, generated | `cli/index` (commands) |
| | Versioning policy | Reference | `sdk/api/versioning` |
| **Concepts** | Grist for widget authors: sections, records, mapping, access | Explanation | `quickstart/concepts` |
| | How the SDK works: the declaration, provider, boundary, runtime | Explanation | `sdk/design/principles` (user-facing part), `concepts` |

**Leaves the site** for the repository (§3.1):
- `contributing/deploy`, `contributing/releasing`, `contributing/real-widgets`;
- `sdk/design/principles` (the maintainer rules), `open-questions`,
  `replica-document`.

### 3.1 Maintainer docs: in the repository, written for agents

All development is done by AI agents, so the maintainer docs follow the
practices agents read best: Markdown in the repository, found from one
entry point, closest file first, one topic per file, commands that run.

| Where | What | From |
| --- | --- | --- |
| `AGENTS.md` (root, `CLAUDE.md` imports it) | The router, short: what the repo is, commands, path map, operating rules, where to read next | today's root `AGENTS.md`, trimmed |
| `packages/core/AGENTS.md`, `packages/create-grist-widget/AGENTS.md`, `apps/www/AGENTS.md`, `examples/AGENTS.md` (each with a `CLAUDE.md` importing it) | Each area's own rules, invariants and commands, read when an agent works there | the root file's area-specific parts, the design principles, the docs-writing rules of §2 |
| `docs/architecture.md` | How the pieces fit: SDK runtime, emulator, CLI and template, site, registry, reference widgets | `sdk/design/principles`, `replica-document`, `contributing/deploy` (overview) |
| `docs/decisions/NNNN-*.md` | One decision per file (context, decision, consequences), numbered, never edited after the fact | the design rules, `open-questions`, D1–D5 of the plan to 1.0, earlier plans' decisions |
| `docs/operations/` | `releasing.md`, `site-deploy.md`, `real-widgets.md`: procedures with the commands to run | `RELEASING.md`, `contributing/*` |
| `.claude/skills/` | Repeatable workflows as skills: the weekly release train, the reference widgets' upgrade, adding an example, writing a docs page | the procedures above, today's prompts |
| `docs/planning/`, `docs/history/`, `TODO.md` | Unchanged: the open plan, finished ones, the ordered work | — |

`CONTRIBUTING.md` stays short and points to `AGENTS.md`; `RELEASING.md`
becomes `docs/operations/releasing.md`; `README.md`, `SECURITY.md` and
`CODE_OF_CONDUCT.md` stay where GitHub looks for them. `check:agents-md`
covers every `AGENTS.md`, so a command or path they name always exists.

**Merged away:** `cheatsheet` (into the guides and the reference), `cookbook`
(into Examples).

## 4. Guardrails, in CI

- **No old forms:** a check that fails on `GRIST_OPTIONS`, `WIDGET_METADATA`,
  `useGrist<`, `useGristContext`, `fetchSelectedTable`, `fetchTable(`,
  `isReady`, `isAvailable` and a bare `renderWithGrist(<…/>)` in any page. It
  starts in report mode, listing today's uses, and blocks once the guides are
  rewritten.
- **Links:** every internal link resolves, and every retired URL redirects
  (below).
- **Snippets:** the existing type check stays.
- **Generated reference:** built from the code on every site build, so an API
  change shows on the site with the release that makes it.
- **Page size:** a warning above about 800 words.

## 5. Redirects

Moved pages keep their old URLs working on both origins:
- `_redirects` on Cloudflare Pages (gristwidgets.com), written by
  `build-site.mjs` from one table;
- a small page per old URL on GitHub Pages, which has no redirects, with a
  canonical link and an immediate redirect to the new URL.

## 6. Order of work

One PR per step. Each keeps `/llms.txt` and the snippet check green.

| Step | Content | Done when |
| --- | --- | --- |
| **R1. Frame** | Navigation skeleton (sections above); redirect table and its generation; the old-forms check in report mode; the page-size warning | The site builds with the new sections; the report lists today's old forms |
| **R2. Get started** | Overview, Your first widget, Examples (generated from `widgets.json`) | A newcomer, or an agent following the page verbatim, reaches a released widget; the old quickstart pages redirect |
| **R3. Guides: data** | Declare and map columns, Read data, Write data, Errors and alerts | No old form left in them |
| **R4. Guides: the rest** | Test, Attachments and REST, Options, Linking and theme, Fast, Deploy and embed, Release, Upgrade, Protect, Registry, Troubleshooting | The old-forms check blocks; `cli/index` is gone |
| **R5. Reference** | Generated API reference per entry point (types and TSDoc, through `fumadocs-typescript` or the API report's doc model); CLI reference from its help text; *Deprecated names* retired | No hand-written list of exports or options is left |
| **R6. Concepts** | The two concept pages; `cheatsheet` and `cookbook` retired with redirects | About 25 user pages; every retired URL redirects |
| **M1. Maintainer docs** (independent of R1–R6, can go first) | §3.1: nested `AGENTS.md`, `docs/architecture.md`, `docs/decisions/`, `docs/operations/`, the skills; the site's `contributing` and `design` sections removed with redirects | The site has no maintainer page; `check:agents-md` covers every `AGENTS.md` |

## 7. What the maintainer decides

- **The structure in §3.** Its sections and page list are the proposal to
  agree on before R1.
- **Generating the API reference** needs TSDoc on every public name: R5
  starts by filling the gaps the API report lists as "(undocumented)" (27 in
  the root entry today).
