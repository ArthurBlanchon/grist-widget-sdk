# Widget factory plan — 2026-11-14

> **Status: proposed.** The direction (§1) was agreed with the maintainer
> on 2026-11-14; the steps (§10) are open for review. It extends the
> [plan to 1.0](./2026-11-14-review-and-1.0-plan.md) and changes the
> audiences of the [documentation rewrite](./2026-11-14-docs-rewrite-plan.md).

## 0. The goal

The people this project serves (developers, tinkerers, no-coders, product
people) build with AI first: Claude Code, Codex or any other harness and
model. The goal is a catalog of **thousands of production-grade Grist
widgets**, built in series, **kept state of the art**, and enriched as
needs arrive.

The catalog is built by the maintainer working with agents. The open
community mostly **reports**: bugs, security problems and feature or widget
requests. It may also submit code. So this is an **open-source widget
factory**: one place where widgets are specified, built, checked,
released and maintained by a repeatable, agent-driven process, with the
maintainer approving what ships.

## 1. Decisions (agreed 2026-11-14)

| # | Decision |
| --- | --- |
| W1 | **One factory, in this repository.** `grist-widget-sdk` becomes the factory: the SDK, the CLI, the template, the docs site and the catalog's widgets live together. No new repository. |
| W2 | **`examples/` merges into the catalog.** There is no separate set of examples: a widget is in the catalog, or it is a code snippet in the docs or a test fixture. |
| W3 | **awesome-grist-widgets is absorbed, then archived.** Its registry moves here; its README points to the catalog. |
| W4 | **The template and `create-grist-widget` stay** for people who build a widget outside the factory, in a repository of their own. |
| W5 | **Bringing the widgets home starts with a pause** to choose a first catalog list on purpose. Porting the six widget repositories and the 16 examples because they exist is not the plan (§10, F3). |

## 2. Why one repository

- **Atomic changes.** An agent that changes the SDK migrates every widget
  in the same pull request, and CI checks them all. Today a breaking
  change waits for six other repositories: #28 is blocked until three of
  them catch up. With thousands of widgets, the separate-repository
  model cannot work.
- **One upgrade instead of N.** One lockfile, one Dependabot flow, one
  release train. Six repositories already meant six pull requests for
  every update.
- **One quality gate.** The bar (§5) is code in one CI, the same for every
  widget, and raising it raises it everywhere.
- **Shared parts.** UI primitives, test helpers and demo-document tooling
  are improved once.
- **Most of it exists already:**
  - the pnpm and turbo workspace, and changesets;
  - `examples/` with its shared host (`examples/_ui`, `examples/_demos`);
  - the generated `widgets.json`;
  - the real-Grist e2e check;
  - zizmor, dependency-review and Scorecard;
  - the rulesets and the `npm` environment.

What one repository costs, and the answer to each:

| Cost | Answer |
| --- | --- |
| CI time grows with the catalog | CI runs only what a change touches (turbo's affected filter). An SDK change runs the whole catalog, sharded. |
| Widget and SDK issues mix | Issue forms and labels (`widget:<slug>`, `area:sdk`) keep them apart. |
| SDK releases and widget releases differ | Widgets are private workspace packages, never published to npm. They have a release train of their own (§4). |
| One bad dependency reaches the whole repository | The dependency rules (`minimumReleaseAge`, review, Scorecard) apply to every widget. A widget's dependencies are reviewed like the SDK's. |

## 3. Target layout

```text
packages/core/                  grist-widget-sdk (npm)
packages/create-grist-widget/   CLI and template tooling (npm)
templates/                      the template for widgets outside the factory
apps/www/                       docs site and the catalog's pages
widgets/<slug>/                 one catalog widget each (private package)
  SPEC.md                       what it is for and when it is done (below)
  src/app/                      the widget, as in a scaffolded repository
  demo/                         its demo document
widgets/_shared/                ui primitives, test helpers (from examples/_ui)
catalog/
  external.json                 widgets built elsewhere, listed on request
  roadmap.md                    the list being built next (F3)
```

**`SPEC.md` is the source of truth for agents.**
- **Front matter, which CI reads:** slug, title, category, status (`draft`,
  `beta`, `stable` or `retired`), the access level and the declared
  columns.
- **Body:**
  - the job the widget does, and for whom;
  - acceptance criteria written as Given/When/Then, each one covered by a
    test;
  - what is out of scope;
  - the demo data.

An agent rebuilds, enriches or modernises a widget from its spec. A CI
check keeps the spec and the code in step: the front matter must match the
widget's `defineGristWidget()` declaration, and every criterion must name a
test.

## 4. From issue to release

1. **Intake.** Each kind of input arrives through its own channel:
   - Issue forms for bug reports, feature requests and new-widget
     proposals. Each form asks for the widget, the Grist version and the
     steps to reproduce.
   - Security problems through private vulnerability reporting only.
   - A widget built elsewhere asks to be listed through an issue form,
     which feeds `catalog/external.json`.
2. **Triage.** An agent labels the issue, reproduces the bug against the
   widget's demo document and proposes acceptance criteria in a comment.
   It runs with no repository write access and no secrets, and treats the
   issue text as data (§6). The maintainer marks the issue `ready`.
3. **Build.** An agent session started by the maintainer works on `ready`
   issues: a branch, the change, an updated `SPEC.md`, the tests, and a
   pull request.
4. **Gate.** Every touched widget goes through §5; a change to the SDK
   sends the whole catalog through it.
5. **Preview.** Each pull request deploys the widgets it changes, with
   their demo pages, and links them in the pull request.
6. **Merge and release.** Only the maintainer merges, and the ruleset
   requires the gate.
   - Widgets are versioned by changesets as private packages, so each
     widget has its own version and changelog.
   - The release train deploys each new version to an immutable URL and
     moves its `latest` channel.
7. **Upkeep, scheduled.** Three loops keep the catalog current:
   - Dependency updates are grouped across the whole catalog: one pull
     request a week, with routine changesets.
   - A periodic **state-of-the-art review** per category opens issues,
     not pull requests: newer libraries, better UX patterns, accessibility.
   - Security advisories open issues.

## 5. The production-grade bar

Each line is enforced by a CI check, not by a document:

| Requirement | Check |
| --- | --- |
| Types, lint, format | `tsc -b`, eslint, prettier |
| Its behaviour, from the spec's criteria | unit tests with `renderWithGrist(<App />, { widget, rows })`, the spec check |
| It mounts as Grist mounts it | `smokeTestWidget` |
| It works in a real Grist | the e2e check (pinned Grist image), on the demo document |
| Accessible | axe on the rendered demo, no serious violations |
| Small | a bundle budget per widget |
| Safe | no `dangerouslySetInnerHTML` or `eval`; URLs from data limited to http(s); a CSP; the lowest access level that works (`full` must be justified in the spec) |
| Its dependencies | dependency-review, `minimumReleaseAge`, licences on an allow list |
| Light and dark | the demo screenshotted in both themes |
| Documented | its catalog page generated from `SPEC.md` (§8) |

## 6. Agents and untrusted input

Everything the public writes is untrusted input: issues, comments,
fork pull requests, and the data a widget reads at run time. A prompt
injection must not be able to ship code.

- **Triage** runs with `issues: write` and nothing else: no `contents:
  write`, no secrets, no checkout of fork code. It writes labels and one
  comment.
- **Builds** are agent sessions the maintainer starts. Nothing an issue
  says can start one with write access, and no workflow uses
  `pull_request_target` with a checkout.
- **Releases** go through a protected environment with the maintainer as
  required reviewer, as the npm release already does.
- **Widgets** treat document data as hostile: escaped output, sanitised
  links, no remote code, and a CSP. The lint rules from the 2026-11-14
  widget fixes become catalog-wide rules.

## 7. Hosting

GitHub Pages limits each site to about 1 GB, on every plan as far as we
know (to confirm against GitHub's documentation). Cloudflare Pages also
caps the number of files per deployment. A single site holding every
version of thousands of widgets fits neither, unless each version is small.

### 7.1 What a widget version weighs today

Measured on the six reference widgets' builds (2026-11-14):

| Widget | `dist/` | Of which |
| --- | --- | --- |
| ask-ai-widget | 25 MB | shiki's language grammars (hundreds of lazy chunks) |
| world-map | 2.5 MB | the map library (1 MB) and a GeoJSON of countries (0.8 MB) |
| scan-with-ai | 2.4 MB | pdf.js and its worker (1.6 MB) |
| gantt-widget | 0.8 MB | main bundle 489 kB |
| create-email-draft | 0.6 MB | main bundle 323 kB, the demo document 164 kB |
| news-feed-widget | 0.6 MB | main bundle 310 kB |

React and React DOM alone weigh 223 kB minified (69 kB gzipped): most of
a simple widget's main bundle. Code from npm makes up nearly all of every
version. The widget's own code is tens of kilobytes.

### 7.2 Shared code from a public CDN, the widget's own code on the site

A widget's page carries only its own code, its CSS and its assets. Every
npm dependency (React, React DOM, `grist-widget-sdk`, the shared UI
package, and heavy libraries such as shiki, pdf.js or a map library and
its data) is loaded from jsDelivr by exact version, through an
[import map](https://developer.mozilla.org/docs/Web/HTML/Element/script/type/importmap)
the build writes.

- **One set of versions per catalog release.** The factory has one
  lockfile, so every widget built in a release uses the same version of
  each dependency. A released version keeps its own import map, so its
  URLs never change.
- **Integrity on every URL.** The import map's `integrity` field holds the
  hash of each file. The CSP allows scripts from the site and
  `cdn.jsdelivr.net` only.
- **Only the production build changes.** `pnpm dev` and the tests still
  resolve from `node_modules`. The e2e check runs against the built page
  with its import map, which catches a wrong mapping.
- **A self-contained variant.** The same build can point the import map at
  copies on the site itself. That is for the networks and organisations
  that forbid third-party CDNs (privacy rules, closed intranets). It still
  stays small: one copy of each dependency version, shared by every widget.

What it gains and what it doesn't:

- **Storage and deploy size** drop by one to two orders of magnitude: from
  0.6–25 MB a version to roughly 50–300 kB. GitHub Pages' 1 GB then holds
  thousands of versions.
- **Loading speed** gains little. Browsers partition their cache by
  top-level site, so a cached copy is shared by widgets in the same Grist
  site whether it comes from the CDN or from our own origin.
- **The costs:**
  - jsDelivr has no service-level agreement, and it has had outages;
  - every user's browser contacts a third party, the privacy point above;
  - shared UI must be an npm package (`@…/ui`), where the shadcn
    primitives are copied source today;
  - Tailwind's CSS stays per widget, around 40 kB, because it is generated
    from the classes each widget uses.

### 7.3 Options

| Option | For | Against |
| --- | --- | --- |
| A. One Pages site, every version, dependencies bundled (today) | No new pieces | Hits the size or file limits; every deploy re-uploads the whole site |
| B. **A, with shared code from the CDN (7.2)** | Each version shrinks 10–100×; stays on GitHub Pages; the hosting is free | jsDelivr at run time (no SLA, privacy); an import-map build to write and maintain |
| C. An R2 bucket behind a Worker | Immutable `/<slug>/<version>/` paths with no file limit; headers and CSP set in one place | A Worker to write and maintain; a paid service at scale |
| D. Whole widgets on npm, served by jsDelivr | Free, versioned, immutable | jsDelivr serves HTML as plain text, so the page needs a host anyway; thousands of npm packages |

**Recommendation: B, with C as the fallback** if the measured catalog
outgrows Pages anyway. F2 builds the pilot both ways (bundled, and with
the import map), measures them, and checks the pilot in a real Grist,
including a self-hosted one. The six current widgets' URLs keep working,
because Grist documents use them. Their `gh-pages` branches are frozen,
and a release from the factory adds a redirect page.

## 8. Catalog and registry

- `widgets.json` and the Grist list `grist-widgets.json` are generated from
  the specs and `catalog/external.json`, and served by the site. A
  self-hosted Grist then points `GRIST_WIDGET_LIST_URL` at the site's
  `grist-widgets.json`.
- Each widget gets a catalog page on the site, generated from `SPEC.md`:
  what it does, the columns it expects, its install URL and its demo.
- awesome-grist-widgets: its README points to the catalog, then the
  repository is archived. Its raw `grist-widgets.json` URL keeps serving
  the last list, which is safe while the maintainer is the only user.

## 9. Documentation: three audiences

The [documentation rewrite](./2026-11-14-docs-rewrite-plan.md) serves
three audiences, AI-first in every case:

1. **People using widgets in Grist,** often no-code: the catalog, and how
   to add a widget to a document. Generated from the specs.
2. **People building outside the factory:** the tutorial, the template's
   `AGENTS.md`, skills, `llms.txt`, and a reference generated from the
   API report. Machine-readable contracts first, prose second.
3. **The factory:** the maintainer docs in the repository (docs plan §3.1,
   M1), plus the skills the loop runs on: `triage-issue`, `new-widget`,
   `fix-issue`, `catalog-upgrade`, `release-widgets`.

## 10. Steps

| Step | Content | Done when |
| --- | --- | --- |
| **F0. Ground** | 0.7 merged (#28) and released; the docs plan's M1 (maintainer docs in the repository) | — |
| **F1. Layout, with one pilot** | The `widgets/` workspace and a widget's package shape; `SPEC.md` and its check; `widgets/_shared`; CI per affected widget; a `pnpm new-widget <slug>` generator built on the template's code. One example ported as the pilot. | The pilot passes the whole §5 bar from this repository |
| **F2. Hosting** | The import-map build (§7.2) and the hosting option chosen from F2's measurements (§7.3); versioned deploys; a preview per pull request | The pilot is served at `/<slug>/<version>/` and `/<slug>/latest/`, works when embedded in Grist (its CDN and self-contained variants), and its per-version size is known |
| **1.0.0** | The plan to 1.0's step F, after the pilot has exercised the API from inside the factory | — |
| **F3. Bring the widgets home** | **Pause first: choose the first catalog list** (below). Then port what is on it, from the six repositories or `examples/`, rewritten to the bar. An example that only illustrates an API becomes a docs snippet or a test fixture. Nothing is ported because it exists. | `catalog/roadmap.md` agreed; the widgets on it pass the bar and are deployed; `examples/` is gone |
| **F4. Intake and triage** | Issue forms, labels, the triage workflow (§6), and `SECURITY.md` updated | A real issue is triaged end to end with no write token |
| **F5. The build loop** | The skills (§9), a pull request template with the bar's checklist, preview links | Three issues go from report to release through the loop |
| **F6. Upkeep** | Catalog-wide weekly updates, the state-of-the-art review schedule, advisories turned into issues | A month of upkeep runs with only the maintainer's approvals |
| **F7. Catalog and registry** | Generated catalog pages, `grist-widgets.json` on the site, awesome-grist-widgets archived, the six old repositories archived with their Pages URLs redirected | Grist's gallery lists the catalog from the site |
| **F8. Scale check** | At 50 widgets: CI time, hosting cost, the maintainer's time per release | Each stays within a budget agreed at F1 |

### The pause at F3: a first list chosen on purpose

Before porting anything, the maintainer and an agent define the first
catalog list together (about 15–25 widgets). Each candidate is judged on:

- **Demand:** what Grist users ask for, from the community forum, Grist's
  own widget gallery and its gaps, and the issues;
- **Difference from Grist itself:** a widget earns its place by doing what
  Grist's built-in views and existing widgets don't;
- **Breadth:** categories such as visualisation, data entry and forms,
  documents and printing, maps and time, integrations, and AI-assisted
  work;
- **Cost:** build complexity, upkeep, the access it needs and how much
  hostile input it handles.

The six existing widgets and the 16 examples are candidates like any
other: each one is kept, reworked or dropped on these criteria. The result
is `catalog/roadmap.md`: one paragraph per widget that seeds its `SPEC.md`.

## 11. Effect on the plan to 1.0

- **Steps A and E** (the six repositories on 0.6.2, then 0.7) still run
  while those repositories are live. Once F3 has brought a widget home,
  its repository only needs its Pages URL kept.
- **1.0 comes after the F1 pilot:** building inside the factory is the
  last check on the API before it is promised stable.
- **TODO.md §2** ("the core widget library") is replaced by these steps.

## 12. What the maintainer decides

1. The domain for widget URLs, for example `widgets.gristwidgets.com`.
2. The hosting option (§7.3), after F2's measurements, and whether the
   CDN or the self-contained variant is the default.
3. The licence for catalog widgets: MIT, as the SDK, recommended.
4. Whether to rename the repository, for example to `grist-widgets`
   (GitHub redirects the old name).
5. At F3: the first catalog list.
