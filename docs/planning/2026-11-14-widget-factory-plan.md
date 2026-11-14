# Widget factory plan — 2026-11-14

> **Status: proposed.** The direction (§1) was agreed with the maintainer
> on 2026-11-14, then sized the same day for a catalog of **30 to 100
> widgets** at most. Every choice below is made for that size; the steps
> (§10) are open for review. It extends the
> [plan to 1.0](./2026-11-14-review-and-1.0-plan.md) and changes the
> audiences of the [documentation rewrite](./2026-11-14-docs-rewrite-plan.md).

## 0. The goal

The people this project serves (developers, tinkerers, no-coders, product
people) build with AI first: Claude Code, Codex or any other harness and
model. The goal is a catalog of **30 to 100 distinct production-grade
Grist widgets**, built in series, **kept state of the art**, and enriched
as needs arrive. Fewer, better widgets: the catalog is curated, not grown
for its own sake.

The catalog is built by the maintainer working with agents. The open
community mostly **reports**: bugs, security problems and feature or widget
requests. It may also submit code. So this is an **open-source widget
factory**: one place where widgets are specified, built, checked,
released and maintained by a repeatable, agent-driven process, with the
maintainer approving what ships.

## 0.1 The rule above every other: simple and durable

The factory has to keep working for years with one maintainer and agents
that change from one year to the next. So:

- **No new service and no new secret** without a measured need. The
  factory runs on what the project already uses: GitHub (repository,
  Actions, Pages, releases) and the Cloudflare Pages build of the site.
- **One way to do each thing.** One build script for the site, one
  release train, one layout per widget. An agent that has seen one widget
  has seen them all.
- **Each new part needs a threshold that is measured, not guessed**
  (§7.3). Until the threshold is reached, the part is not built.
- **Static files only.** Widgets are static pages. Nothing runs on a
  server, so nothing has to be kept running.

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
  them catch up. With 30 to 100 widgets, it would be 30 to 100 pull
  requests for each change.
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
2. **Triage.** In a session the maintainer starts, an agent runs the
   `triage-issue` skill over new issues in a batch. For each issue it:
   - labels it;
   - reproduces the bug against the widget's demo document;
   - proposes acceptance criteria in a comment.

   It treats the issue text as data (§6), and the maintainer marks the
   issue `ready`. At this catalog's size, issues are expected in tens a
   month, not hundreds. A triage workflow running by itself on every new
   issue is only added if the volume calls for it, because it is one more
   thing an attacker can reach.
3. **Build.** An agent session started by the maintainer works on `ready`
   issues: a branch, the change, an updated `SPEC.md`, the tests, and a
   pull request.
4. **Gate.** Every touched widget goes through §5; a change to the SDK
   sends the whole catalog through it.
5. **Preview.** The site's Cloudflare build of the pull request already
   contains the widgets it changes, with their demo pages (§7.3). That
   build is also a second, independent run of the build.
6. **Merge and release.** Only the maintainer merges, and the ruleset
   requires the gate.
   - Widgets are versioned by changesets as private packages, so each
     widget has its own version and changelog.
   - The release train deploys each new version to an immutable URL and
     moves its `latest` channel.
7. **Upkeep, scheduled.** Three loops keep the catalog current:
   - Dependency updates are grouped across the whole catalog: one pull
     request a week. Widgets are released from them **once a month**, or
     at once for a security fix, so a version is not cut every week for
     every widget (§7).
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

- **Triage** reads issues and writes labels and comments, nothing else:
  no `contents: write`, no secrets, no checkout of fork code. The same
  holds if it later becomes a workflow (`issues: write` only).
- **Builds** are agent sessions the maintainer starts. Nothing an issue
  says can start one with write access, and no workflow uses
  `pull_request_target` with a checkout.
- **Releases** go through a protected environment with the maintainer as
  required reviewer, as the npm release already does.
- **Widgets** treat document data as hostile: escaped output, sanitised
  links, no remote code, and a CSP. The lint rules from the 2026-11-14
  widget fixes become catalog-wide rules.

## 7. Hosting

### 7.1 What a widget version weighs today

Measured on the six reference widgets' builds (2026-11-14):

| Widget | `dist/` | Of which |
| --- | --- | --- |
| ask-ai-widget | 25 MB | shiki's grammars for every language (hundreds of lazy chunks) |
| world-map | 2.5 MB | the map library (1 MB) and a GeoJSON of countries (0.8 MB) |
| scan-with-ai | 2.4 MB | pdf.js and its worker (1.6 MB) |
| gantt-widget | 0.8 MB | main bundle 489 kB |
| create-email-draft | 0.6 MB | main bundle 323 kB, CSS 43 kB, Geist fonts 76 kB, demo 172 kB |
| news-feed-widget | 0.6 MB | main bundle 310 kB |

A simple widget's version breaks down as follows:
- about **250 kB of shared runtime**: React and React DOM alone are 223 kB
  minified, and the SDK is most of the rest;
- **76 kB of fonts** and the **172 kB demo**, identical in every version;
- about **120 kB of its own**: code, CSS and the HTML page.

### 7.2 The arithmetic for 30–100 widgets

The assumption: about 20 releases per widget per year. That is the
monthly dependency release (§4) plus fixes and features.

| Layout of a version | Size each | 30 widgets, per year | 100 widgets, per year |
| --- | --- | --- | --- |
| Bundled, as today | ~0.6 MB | ~0.36 GB | ~1.2 GB |
| Demo once per widget, fonts shared | ~0.37 MB | ~0.22 GB | ~0.74 GB |
| …and a shared runtime | ~0.12 MB | ~0.07 GB | ~0.24 GB |

The heavy libraries stay with the widgets that use them. Trimming them
pays at any size: shiki with a dozen languages instead of all of them
takes ask-ai from 25 MB to about 2 MB.

### 7.3 The solution: the site that already exists

The documentation site already has the hosting the factory needs:
- **One build script** (`scripts/build-site.mjs`) assembles `site/`: the
  docs, every example's widget and its demo page.
- **Two origins, deliberately:** GitHub Pages
  (`arthurblanchon.github.io/grist-widget-sdk/`) and Cloudflare Pages
  (`gristwidgets.com`), each with a complete copy. Some company networks
  allow github.io and block unknown domains, others the reverse.
- **Cloudflare builds every pull request.** That gives a preview of the
  whole site and a second, independent run of the build: a second CI.

The factory adds no hosting of its own. Catalog widgets take the place of
`/examples/<id>/` in that same site:
- `/widgets/<slug>/<version>/`, immutable;
- `/widgets/<slug>/latest/`;
- `/widgets/<slug>/demo/`, once per widget.

The same script builds the site on both origins, so each pull request's
Cloudflare preview is also the preview of the widgets it changes. Both
existing origins keep serving, and there is no new domain, CDN, bucket or
mirror to set up.

**Two pieces are added, and nothing else:**
1. **Where released versions are kept.** The release train builds each
   new widget version once, with relative paths, so it works on both
   origins. It commits the build to an append-only `widgets-dist` branch
   as `/<slug>/<version>/`. `build-site.mjs` copies that branch into
   `site/widgets/` on both origins, and the branch's history is squashed
   from time to time. A version is never rebuilt, so what a Grist document
   loads never changes under it.
2. **A size and file budget in CI.** The site is 133 MB and 2,105 files
   today, which leaves about 870 MB under GitHub Pages' 1 GB. Cloudflare
   Pages caps the number of files per deployment (about 20,000 on the free
   plan, to confirm). The site build reports both figures and warns at
   60 % of each limit.

**What waits for a measured threshold:**
- **F2's cheap savings**, done from the start: the demo once per widget,
  the fonts shared under `/_shared/`, shiki and the other heavy libraries
  trimmed.
- **A shared runtime.** One ESM bundle per catalog release (React, React
  DOM, the JSX runtime, `grist-widget-sdk`, `grist-widget-sdk/app`),
  reached through an import map of five entries, each with its integrity
  hash. Built only when the budget passes 40 %, or the catalog 40 widgets.
  Versions released before it keep their bundle.
- **A retention rule,** at the 60 % warning. For example: keep every
  version under a year old and the last patch of each minor; a removed
  version becomes a one-line page that sends to `latest`.

The six current widgets' URLs on their own Pages sites keep working,
because Grist documents use them. Their `gh-pages` branches are frozen,
and a release from the factory adds a page there that sends to the new
URL.

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
| **F2. Versions in the site** | Catalog widgets in `build-site.mjs` under `/widgets/<slug>/` (§7.3); the `widgets-dist` branch written by the release train; the demo once per widget, shared fonts; the size and file budget | The pilot is served at `/widgets/<slug>/<version>/` and `/latest/` on both origins, works when embedded in Grist, its pull request preview shows it, and its per-version size is known |
| **1.0.0** | The plan to 1.0's step F, after the pilot has exercised the API from inside the factory | — |
| **F3. Bring the widgets home** | **Pause first: choose the first catalog list** (below). Then port what is on it, from the six repositories or `examples/`, rewritten to the bar. An example that only illustrates an API becomes a docs snippet or a test fixture. Nothing is ported because it exists. | `catalog/roadmap.md` agreed; the widgets on it pass the bar and are deployed; `examples/` is gone |
| **F4. Intake and triage** | Issue forms, labels, the `triage-issue` skill (§4, §6), and `SECURITY.md` updated | A batch of real issues is triaged end to end by the skill |
| **F5. The build loop** | The skills (§9), a pull request template with the bar's checklist, preview links | Three issues go from report to release through the loop |
| **F6. Upkeep** | Catalog-wide weekly updates, the state-of-the-art review schedule, advisories turned into issues | A month of upkeep runs with only the maintainer's approvals |
| **F7. Catalog and registry** | Generated catalog pages, `grist-widgets.json` on the site, awesome-grist-widgets archived, the six old repositories archived with their Pages URLs redirected | Grist's gallery lists the catalog from the site |
| **F8. Size check** | At 30 widgets, then again at 60: CI time (the whole catalog on an SDK change, sharded), site size against its budget, the maintainer's time per release; the shared runtime built if §7.3's threshold is reached | Each stays within the budget agreed at F1 |

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

1. Which of the two origins the catalog shows as a widget's install URL
   (the other is listed as the alternative), before F2: it is what Grist
   documents will keep.
2. Nothing else on hosting. It stays the existing site until a threshold
   in §7.3 is reached.
3. The licence for catalog widgets: MIT, as the SDK, recommended.
4. Whether to rename the repository, for example to `grist-widgets`
   (GitHub redirects the old name).
5. At F3: the first catalog list.
