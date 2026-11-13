# Landing page & documentation — transversal review and improvement plan

**Scope:** `apps/www` (landing site + docs, the surface that survives), with the
repo-wide consequences of deleting `apps/docs` and `apps/web`.

**Target user:** developers who like shadcn/ui and build with AI coding agents.
Two entry paths matter and are weighted accordingly throughout:

1. **Human path** — npm or GitHub → landing → browse something visual → ship a widget.
2. **Agent path** — an LLM is pointed at the project and must produce a working
   widget from `llms.txt` / page markdown / `AGENTS.md` alone.

**Two decisions are now settled and this plan is built around them:**

- **Presentation model — shadcn as inspiration, not as architecture.** What is
  borrowed is *how shadcn presents a toolkit*: visual, practical, the real thing
  running in front of you instead of described. What is **not** borrowed is
  shadcn's distribution machinery — no copy-paste registry protocol, no `add`
  command, no component-installer. Part 2 works out what the Grist-native
  equivalent of "seeing the component" is, because a hook is not a button and
  the answer is specific to this domain.
- **Domain — `gristwidgets.com`**, GitHub Pages not yet pointed at it. DNS is
  already done (verified: all four Pages apex A records, plus `www` with
  AAAA); the missing half is repo-side. Part 4 covers the migration.

**Method:** read every page in `apps/www/content/docs` and every route/component
in `apps/www`; diffed against `apps/docs` (the VitePress source it was ported
from); built twice — bare and with `WWW_BASE=/grist-widget-sdk/` — and inspected
emitted HTML in `apps/www/out/` rather than inferring link behavior; resolved DNS
for every domain referenced. Everything in Part 1 is verified against the repo or
the built output.

---

## Part 0 — Verdict

The port from VitePress to fumadocs landed the *content* but not the *finish*,
and the site is currently organised as documentation rather than as a catalog.

What already works: 35 doc pages with real API coverage, a clean build (112
static pages, TypeScript passes, `output: export`, correct basePath, `.nojekyll`
guard), and AI-surface foundations better than most projects this size —
`/llms.txt`, `/llms-full.txt`, per-page `.md`, `MarkdownCopyButton` everywhere.

What's missing splits in two:

**Defects** (Part 1) — two hard 404s, four links to a domain with no DNS record,
30 of 35 pages repeating their own description verbatim, and a cookbook that
claims its code is type-checked when the port silently broke that guarantee.

**A missing presentation surface** (Part 2) — the project already owns the best
possible demonstration of what the toolkit does, and the website links away from
it. `apps/playground` is a live, emulator-backed rig where a **Grist document
sits next to a running widget**: 364 lines of split-pane shell, a 636-line
document inspector built on the SDK's own public `emulator/devtools` subpath,
editable rows, switchable access levels, curated document fixtures, and URL
params that make any doc + widget combination addressable. It is the single most
convincing artifact in the repo. On the website it appears as a text link.

That is the real headline. The work is not "build a gallery" — it is "stop
hiding the thing that already demonstrates the toolkit."

---

## Part 1 — Findings

Priority: **P0** blocks the final landing · **P1** materially changes whether a
new user succeeds · **P2** quality and durability · **P3** polish.

### A. Broken links and dead references (P0)

**A1 — Two hard 404s: `./getting-started`.**
`content/docs/sdk/guide/introduction.mdx:85` and
`content/docs/sdk/guide/raw-plugin-api-vs-sdk.mdx:120` link to
`./getting-started`. That page existed in VitePress
(`apps/docs/guide/getting-started.md`, 187 lines) and was **not** ported.

fumadocs' `createRelativeLink` rewrites relative links only when they resolve to
a real page; misses pass through untouched. Verified in built HTML:

```
docs/sdk/guide/concepts        →  href="/grist-widget-sdk/docs/sdk/guide/concepts/"   ✅ rewritten
docs/sdk/guide/getting-started →  href="./getting-started"                            ❌ raw
```

With `trailingSlash: true` this resolves to
`/docs/sdk/guide/introduction/getting-started` → 404. It is the **first bullet of
"Next steps" on the guide's first page**.

**A2 — Four links to a domain with no DNS record.** The hyphenated
`grist-widgets.com` does not exist:

| Domain | DNS |
| --- | --- |
| `grist-widgets.com` | **no record** |
| `gristwidgets.com` | `185.199.108–111.153` (all four GitHub Pages apex A records) |
| `www.gristwidgets.com` | same four, plus AAAA `2606:50c0:800{0..3}::153` |
| `demo.grist-widgets.com` | `2606:4700:3034::ac43:85d9` (Cloudflare) — live, leave alone |

Affected: `introduction.mdx:86` (`/demos`), `open-questions.mdx:9` (`/work`),
`open-questions.mdx:172,177` (`/tasks`).

**A3 — Both published packages point `homepage` at the dead domain.**
`packages/core/package.json:27` **and**
`packages/create-grist-widget/package.json:27` both set
`"homepage": "https://grist-widgets.com"`. This renders as the **Homepage link
on the npm page** for both packages — the most likely first click for this
audience, going nowhere. (My first pass flagged only `packages/core`; the CLI
has the same bug.) Both become `https://gristwidgets.com` under Part 4.

**A4 — "Edit on GitHub" is wrong on all 35 doc pages.**
`app/docs/[[...slug]]/page.tsx:31` builds `.../blob/main/content/docs/${page.path}`;
the real path is `apps/www/content/docs/...`.

**A5 — `apps/docs`-relative links that die on deletion.** Three are *published
artifacts*, so they break for consumers, not just repo browsers:

- `packages/core/README.md:16` → `apps/docs/guide/raw-plugin-api-vs-sdk.md` (**shipped to npm**)
- `packages/core/README.md:177` → `apps/docs/design/replica-document.md` (**shipped to npm**)
- `templates/grist-widget-template-vite/README.md:16` → `apps/docs/guide/testing.md` (**shipped in every scaffolded widget**)

Repo-internal: `templates/…/README.md:9,46`, `CONTRIBUTING.md:11`,
root `README.md:5,11,57,60,70,75`.

**A6 — `pnpm test` breaks on deletion.** `package.json:18` runs
`pnpm --filter docs build`. Also dangling: `dev:docs`, `build:docs`,
`preview:docs`, `build:web`. `.github/workflows/*` do **not** reference either
app — CI is safe; this is root-scripts-only.

### B. `apps/docs` → `apps/www` migration audit (P0 — deletion gate)

Full file-by-file audit of all 50 content files in `apps/docs`, with a
content-level diff (headings + prose, code fences excluded) for every page that
has a counterpart — not just an existence check.

**B0 — The 30 ported prose pages are faithful. No content was lost.**
Word deltas run ±3, which is frontmatter and formatting. Two pages flagged on
first pass and both cleared on inspection:

- `guide/cheatsheet.md` (−219 words) and `guide/cookbook.md` (−128) look like
  losses but are not: the port rewrote absolute
  `https://arthurblanchon.github.io/grist-widget-sdk/playground/?url=…` demo
  links to relative `/playground/?url=…`, and `# Heading` became frontmatter
  `title`. Every section, recipe, and live-demo link is present.

So the guide/API/design port can be trusted. Everything below is what the port
did *not* carry across.

**B1 — Fourteen files with no counterpart.** Disposition per file:

| `apps/docs` file | Words | Disposition |
| --- | --- | --- |
| `guide/getting-started.md` | 735 | **MUST PORT** — target of the two 404s in A1 |
| `files/deploy.md` | 1707 | **MUST PORT** — `deploy-apps.yml:28,48` cites it as canonical |
| `files/releasing.md` | 1373 | **MUST PORT** — live Changesets/canary process |
| `files/start-here.md` | 356 | **MUST PORT** — becomes root `AGENTS.md` |
| `files/conventions.md` | 432 | PORT — naming, boundaries, error handling, testing |
| `files/grist-plugin-api.md` | 252 | PORT — host-bridge quirks, not documented elsewhere |
| `files/agent-workflows.md` | 149 | PORT — small, feature/bugfix/docs/release shapes |
| `files/vite-library-mode.md` | 128 | PORT — `packages/core` is tsup, not Vite |
| `files/shadcn-conventions.md` | 111 | PORT **and update** — says shadcn UI lives in `apps/playground`; `apps/www` now has its own |
| `files/index.md` | 304 | ADAPT — the `/files/` section index; becomes the new section landing |
| `work.md` | 255 | PORT **and update** — its quality bar still says `pnpm --filter docs build` |
| `guide/templates.md` | 338 | MOSTLY SUPERSEDED by `/docs/cli` — see B2 |
| `demos.md` | 448 | FOLD into the Phase 3 demo pages — content still needed |
| `files/vitepress-doc.md` | 102 | **DROP** — replace with a fumadocs authoring equivalent |

**B2 — `guide/templates.md` is ~85% absorbed, with one real remainder.**
The "What you get" list and "Hand-rolled" section are near-verbatim in
`/docs/cli/index.mdx`. Two pieces are not:

- **"HTML and Next.js (planned)"** — the only place these queued templates are
  described. Genuinely unmigrated.
- A "Live preview" link to `…github.io/grist-widget-sdk/template/latest/`.
  That deploy was **removed** (`deploy-apps.yml`: "deploy-template-showcase.yml
  … has been removed entirely"), so the URL is dead. The replacement — the
  external `grist-widget-template` Pages site — is already in the www nav, so
  this one migrated correctly and only the stale URL needs dropping.

**B3 — Partial content loss in `index.md` → `sdk/index.mdx`.** The only ported
page that did lose material. Two whole sections dropped:

- **"What it looks like"** — the `hello-world` widget transcluded from
  `apps/playground/…/WidgetApp.tsx`, framed as "the whole idea in a handful of
  lines", plus a "Try it live" link. This is the closest thing the old site had
  to the Part 2 demo, and it is exactly the material the new landing page needs.
- **"Start with Vite"** — the `npm create grist-widget` block.

Also, of the eight hero feature cards, six survived as `<Cards>` in
`sdk/index.mdx`; **"Demos"** and **"Agent guide"** were dropped — the two
pointing at the demo catalogue and the agent manual.

**B4 — The guide's sidebar grouping exists only in `config.mts`.** This is
content that lives in configuration, so a file-level audit misses it. The
VitePress config grouped the guide into five sections:

```
Quickstart        getting-started · raw-plugin-api-vs-sdk · templates ·
                  cheatsheet · troubleshooting · cookbook
Overview          introduction
Concepts          concepts
Building widgets  column-mapping · reading-data · writing-data ·
                  widget-options · attachments-and-rest · linking-and-theme
Advanced topics   typing · handshake · error-handling · performance · testing
```

The www port flattened all 17 into one list (`sdk/guide/meta.json`). So D5 is
not a new proposal — it is **restoring an IA the port dropped**, and the
grouping is already written down. Two smaller config-level details: the old
`referenceSidebar` deliberately unified `/api/` and `/design/` under one
"Reference" mental model, and the old `editLink` pattern was correct
(`edit/main/apps/docs/:path`) — A4 is a regression introduced by the port, not
an inherited bug.

**B5 — `public/llms.txt` was hand-curated; the generated one is a regression.**
`apps/docs/public/llms.txt` opens with a written summary ("One provider, one
boundary, one hook covers 90% of widget needs…"), lists *canonical entry
points*, and has a dedicated **"For AI agents"** section. `apps/www`'s
auto-generated `/llms.txt` is a flat dump of every page using the descriptions
that E1/E2 shows are duplicated and truncated. For the audience this project
targets, that is the wrong direction — **the curation is the thing worth
migrating**, as a hand-written header above the generated index.

**B6 — Stubs and assets.**

- `roadmap.md` / `tasks.md` / `changelog.md` are 6–10 line VitePress shells that
  `<!--@include: ../../ROADMAP.md{8,}-->` the root files. fumadocs has no
  equivalent directive, so this needs a decision: link out to GitHub, or add a
  build step that inlines them. Do not port the stubs as-is — they would render
  as empty pages.
- `public/hero.png` (40 KB) is **not referenced** by any page or by
  `config.mts`. Safe to drop.
- `public/llms.txt` / `llms-full.txt` — superseded mechanically by www's
  generated routes; see B5 for the part that isn't.

**B7 — Deletion gate.** `apps/docs` can be removed once B1's MUST PORTs are
done (`getting-started`, `deploy`, `releasing`, `start-here`), B3's two sections
are recovered, and A5's three *published* links are repointed
(`packages/core/README.md:16,177`, `templates/…/README.md:16` — these ship to
npm and into every scaffolded widget). Everything else in B can follow the
deletion, since the content is preserved in git history and nothing external
references it.

### C. The landing page (P1)

`app/(home)/page.tsx` is 38 lines: heading, subheading, two buttons. Full copy:

> **Extend Grist with custom widgets**
> Discover production-grade widgets and AI-powered tools to build your own.
> `[Search widgets]` `[Build your own]`

The gap is not "needs more sections" — it is that the page **shows nothing
working**. shadcn's landing convinces you in one scroll because real components
are rendering in front of you. This page describes; it never demonstrates. See
Part 2 for what "demonstrate" has to mean for a Grist widget.

Specifics: the package is never named; no code; no install command; nothing below
the fold; `/llms.txt` and `/llms-full.txt` are built and served but linked from
nowhere; and the type ramp at `page-header.tsx:22` runs to `lg:text-9xl` (128px),
where the current headline wraps to four or five lines before any content.

### D. Information architecture (P1)

**D1 — Six nav links, four into `/docs`.** `lib/layout.shared.tsx:11-22`:
Search · Build · Template · CLI · SDK · Registry. "Build" is `/docs/quickstart`;
CLI/SDK/Registry are all `/docs/*` that the sidebar already covers.

**D2 — "Search" is overloaded three ways.** Nav "Search" → `/search`, which is
the *widget registry*, whose own `<h1>` reads "Widget registry" — while ⌘K is
*documentation* search and `/docs/registry` is a third page *about* the registry.
Three surfaces, two names, no clear mapping.

**D3 — Two competing entry pages.** `/` and `/docs` both act as landings, and
`/docs/index.mdx` is 11 lines of cards duplicating the nav.

**D4 — `/docs/sdk/index.mdx` is two adjacent `<Cards>` blocks** (six, then
three) with no separating prose. Reads as a link dump.

**D5 — 17 guide pages in one flat list** (`sdk/guide/meta.json`). Concepts, task
guides, and reference (cheatsheet, troubleshooting, cookbook) are three reading
modes flattened into one column.

### E. Content quality regressions (P2)

**E1 — 30 of 35 pages duplicate their description as the first body paragraph.**
The template renders `description` under the `<h1>`
(`app/docs/[[...slug]]/page.tsx:25`) and the ported body repeats it word for
word. Every affected page opens by saying the same sentence twice.

**E2 — 13 descriptions are truncated mid-sentence**, auto-scraped and cut:
`introduction.mdx` *"…Its goal is one thing:"* · `provider-boundary.mdx` *"These
two components form the canonical app-root pattern:"* · `use-grist-schema.mdx`
*"…Useful for:"* · `reading-data.mdx` *"There are two read paths in the SDK:"* ·
`typing.mdx` *"The SDK uses two generics:"* · `error-handling.mdx` *"…three
layers of error reporting:"* · plus `cookbook`, `cheatsheet`, `principles`,
`handshake`, `widget-options`, `raw-plugin-api-vs-sdk` cut with `...`.

Each is used in **four** places: page subtitle, `<meta name="description">`, the
generated OG image (`app/og/docs/[...slug]/route.tsx:16`), and `/llms.txt` —
confirmed present in built `out/llms.txt`. So an agent reads *"Its goal is one
thing:"* as the summary of the SDK introduction.

**E3 — Cookbook and cheat sheet will drift, and both claim otherwise.**
VitePress transcluded at build time:

```
apps/docs/guide/cookbook.md:16    <<< ../../playground/src/widgets/form-edit/WidgetApp.tsx
```

105 lines, always in sync, type-checked by `pnpm --filter playground
build:widgets`. The port replaced this with pasted copies: `cookbook.mdx` is now
**1233 lines**, `cheatsheet.mdx` **1342** — together 35% of the corpus. Both
still say:

> Each recipe below embeds the **canonical source** … type-checked when you run
> `pnpm --filter playground build:widgets`

Untrue of the copies. Nothing type-checks them, compares them to
`apps/playground/src/widgets/*/WidgetApp.tsx`, or fails on divergence. **Part 2
dissolves this problem rather than patching it** — if block pages are generated
from the registry, drift is structurally impossible.

**E4 — `principles.mdx:159-167` describes the repo as it was**, on the site that
replaced it: *"`apps/docs/` — **this** VitePress documentation site"* (the reader
is on fumadocs), and `apps/web/` described as the deployed root site (replaced by
`apps/www`, per `deploy-apps.yml:13-14`). Line 166 points at `/files/deploy`, a
route that doesn't exist here.

**E5 — VitePress-era link text across `api/index.mdx`.** ~20 rows read
`[/api/provider-boundary](./provider-boundary)` — targets resolve, visible text
is the old route. Same in the `helpers` rows.

**E6 — `quickstart.mdx`:** orphan `<Badge>grist-widget-template</Badge>` at
line 12 above the first heading; `title` ("Build a Grist custom widget in
minutes") disagrees with the first `<h1>` ("Quickstart"); description promises
"browse what's already been released below" and nothing is listed below.

### F. Discoverability, SEO, agent surface (P2)

**Already good — keep:** `/llms.txt`, `/llms-full.txt`, per-page
`/llms.mdx/docs/*/content.md`, `MarkdownCopyButton` + `ViewOptionsPopover`,
static Orama search, per-page OG images.

| Gap | Evidence |
| --- | --- |
| No `sitemap.xml` | no `app/sitemap.ts`; absent from `out/` |
| No `robots.txt` | no `app/robots.ts`; absent from `out/` |
| No favicon | no `app/icon.*`; absent from `out/` |
| No OG image for `/` or `/search` | `app/layout.tsx` sets no `openGraph.images`; OG route is docs-only |
| No custom 404 | default Next `404.html` only |
| No root `AGENTS.md` | the file agents look for first |
| `/llms.txt` linked from nowhere | not in nav, footer, or landing |
| No canonical URLs | no `alternates.canonical` |

`AGENTS.md` is the highest-leverage single item here — and the content already
exists as `apps/docs/files/start-here.md`, inside the directory being deleted.

### G. `apps/www` code quality (P3)

**G1 — Dead file + unused dep.** `lib/cn.ts` is `export { cn } from 'cnfast'`
and **nothing imports it**; all seven consumers use `@/lib/utils`. Delete the
file, drop `cnfast`.

**G2 — Scaffold README never replaced.** `apps/www/README.md` is verbatim
create-fumadocs-app output — and becomes the *only* app README post-deletion.

**G3 — Registry fetch has no resilience.** `app/search/search-client.tsx:26`
fetches `raw.githubusercontent.com` on every load: no timeout, retry, or
build-time fallback. Offline or rate-limited → empty page.

**G4 — No validation on registry data.** `json()` is cast straight to
`RegistryWidget[]`, then `widget.widgetUrl` is rendered into an `href`. The
registry repo's CI validates entries; this consumer trusts the file implicitly.

**G5 — Only five shadcn primitives** (badge, button, card, input, skeleton).
Part 2 needs considerably more.

**G6 — `pnpm test` runs the full `www` Next build** — the slowest step, every run.

---

## Part 2 — How to present the toolkit

### 2.1 Why shadcn's presentation doesn't transfer directly

shadcn's preview works because its unit is **self-evident**: render a Button and
you have seen everything a Button is. Preview / Code, two tabs, done.

Nothing in this toolkit is self-evident that way. `useGrist()` renders nothing.
`<GristBoundary>` is invisible when things go well. Column mapping is a
*relationship*, not a visual. Rendering a widget on its own shows a box saying
"Select a row" — which demonstrates nothing, and is actively worse than a
screenshot.

The reason is structural: **a Grist widget has no meaning without a document.**
The entire toolkit exists to manage one relationship — widget ↔ document. A
presentation that shows only the widget has cropped out the half that matters.

### 2.2 The Grist-native unit: document ↔ widget ↔ code

So the borrowed idea is "show the real thing running", and the Grist-specific
form it takes is **three panes instead of two**:

```
┌─────────────────┬─────────────────┬─────────────────┐
│    DOCUMENT     │     WIDGET      │      CODE       │
│  editable rows  │  live, reacting │  the source     │
│  columns, access│  to the doc     │  that does it   │
└─────────────────┴─────────────────┴─────────────────┘
        edit a cell  →  watch it appear  →  see the line
```

Edit a cell on the left, watch the widget update in the middle, read the hook
that made it happen on the right. Flip access from `full` to `read table` and
watch the boundary catch it. Change a column mapping and watch the widget
re-resolve.

That is a demonstration shadcn structurally *cannot* make, because a Button has
no document behind it. It is the most direct possible answer to "what does this
toolkit do", and it is worth building the site around rather than treating as a
docs embellishment.

### 2.3 Two of the three panes already ship

This is not a proposal from zero. `apps/playground` already implements the
document ↔ widget half, and it is substantial:

| Piece | File | Lines | What it does |
| --- | --- | --- | --- |
| Split-pane shell | `pages/home-page.tsx` | 364 | `createGristEmulator` + `presets`, resizable panels |
| Document inspector | `components/document-inspector.tsx` | 636 | Editable rows/columns, access-level switcher, mapping state |
| Document picker | `components/document-picker.tsx` | 159 | Swap the backing document |
| Widget picker | `components/widget-picker.tsx` | 133 | Swap the widget |
| Document fixtures | `data/document-examples.ts` | — | Todo list, contacts, replica+samples, … |

The inspector is built on **`grist-widget-sdk/emulator/devtools`** —
`useEmulatorColumns`, `useEmulatorRows`, `useEmulatorSnapshot` — a *public*
exported subpath of the SDK. So the live-document pane is a supported capability
of the shipped package, not playground-private scaffolding.

Two further facts make embedding cheap:

**Any combination is already URL-addressable.** `hooks/use-params-nav.ts`
defines `?url=` (widget) and `?document=` (fixture). So
`/playground/?url=widget.html?id=task-board&document=templates/todo-list.grist.json`
already renders a specific widget against a specific document — today, no new
code.

**It is same-origin.** `deploy-apps.yml` publishes `apps/www` at the site root
and `apps/playground` under `/playground/` in **one** Pages deployment. An
`<iframe>` from a docs page to the playground needs no CORS work.

This matters for a constraint the repo has deliberately maintained:
`apps/www` has **no `grist-widget-sdk` dependency** (README:58,
`deploy-apps.yml`). Iframing the playground preserves that boundary exactly —
www stays a pure static site, the playground stays the only thing that links
the SDK, and the demo is live regardless.

**The only missing pane is the code** — and that is the same fix as E3. The
source is read from `apps/playground/src/widgets/<id>/WidgetApp.tsx` at build
time instead of pasted, which is what VitePress's `<<<` did before the port.

### 2.4 The one piece of plumbing needed

Deliberately minimal — this is a build-time index for presentation, **not** a
distribution protocol. No JSON endpoints for third parties, no installer, no
schema for outside consumers.

The site needs two things the repo doesn't currently expose:

1. **Human-readable titles.** 18 of 19 widgets export a static
   `WIDGET_METADATA` (`{ title, description }`); `hello-world` is the only gap.
   But it is consumed only at *runtime*, via `useWidgetMetadata()` on mount.
   Nothing reads it at build time — which is exactly why
   `data/widget-examples.ts:47` labels the picker with raw ids like
   `"task-board"` instead of `"Task board"`.
2. **Source text**, read from the file rather than duplicated into MDX.

One small build step that walks the widgets directory and emits
`{ id, title, description, requiredAccess, columns, source }` covers both, and
serves three consumers: the site's demo pages, the playground's own picker (real
titles at last), and the docs pages that currently paste code.

`GRIST_OPTIONS` is worth including because it already declares `requiredAccess`
and the column contract — which is precisely the "what does this widget need"
caption a demo pane should show above the document.

Side effect worth naming: once code is read rather than pasted, **E3 stops being
a defect to patch and becomes impossible**, and ~2,500 duplicated lines leave the
docs corpus.

### 2.5 Explicitly not doing

Listed so they don't creep back in under other names:

- No copy-paste component registry or `/r/<id>.json` endpoints.
- No `add` command in the CLI. `create-grist-widget` scaffolds a widget; that is
  the right scope for it.
- No second "component tier". `grist-status-chip.tsx` and the `v4-minimal`
  grid files are real and reusable, but promoting them into an installable
  catalog is shadcn's distribution model, not its presentation model.
- No MCP server. Revisit only if there is demand, and on its own merits.

---

## Part 3 — Plan

Six phases. Phase 1 gates the `apps/docs` deletion. Phases 2–3 build the catalog.
Phase 4 is the domain. 5–6 harden.

### Phase 1 — Unblock the deletion, fix what's broken (P0)

Small, non-optional, and a prerequisite for removing `apps/docs`/`apps/web`
without regressing published artifacts.

Ordered as a gate: 1–6 must land **before** `apps/docs` is deleted (B7); 7–12
can follow.

1. **Port `getting-started`** → `content/docs/sdk/guide/getting-started.mdx`,
   add to `sdk/guide/meta.json`. Fixes A1. Split of duties: quickstart = scaffold
   path, getting-started = install-into-existing-app path.
2. **Port `deploy.md` and `releasing.md`** — `deploy-apps.yml:28,48` cites the
   former as canonical; both describe live infrastructure.
3. **Port `start-here.md` → root `AGENTS.md`** (B1). Doing it here rather than in
   Phase 6 means the agent manual never has a window where it doesn't exist.
4. **Recover the two dropped `index.md` sections** (B3) — "What it looks like"
   (the transcluded `hello-world` + "Try it live") and "Start with Vite". Both
   are landing-page material; park them in `/docs/quickstart` now and let
   Phase 3 place them properly.
5. **Repoint every `apps/docs` reference**, published ones first
   (`packages/core/README.md:16,177`, `templates/…/README.md:16` — these ship to
   npm and into every scaffolded widget), then repo-internal.
6. **Clean root scripts** — drop `dev:docs`/`build:docs`/`preview:docs`/`build:web`;
   remove `--filter docs build` from `test` (A6).

   → *`apps/docs` and `apps/web` can now be deleted*, along with their
   `deploy-apps.yml` comment references.

7. **Port the remaining `files/` pages** (B1: conventions, agent-workflows,
   grist-plugin-api, vite-library-mode, shadcn-conventions + `files/index.md`
   as the section landing) and `work.md`. Update the two that are stale:
   `shadcn-conventions` predates `apps/www` having its own shadcn setup, and
   `work.md`'s quality bar still lists `pnpm --filter docs build`.
8. **Restore the guide sidebar grouping** from `config.mts` (B4) into
   `sdk/guide/meta.json` — Quickstart · Overview · Concepts · Building widgets ·
   Advanced topics. This is D5, and the grouping is already written down.
9. **Carry over `templates.md`'s one remainder** (B2) — the "HTML and Next.js
   (planned)" section — into `/docs/cli`, and drop the dead
   `…/template/latest/` preview URL.
10. **Decide the roadmap/tasks/changelog question** (B6) — link out to GitHub, or
    add a build step that inlines the root files. Do not port the VitePress
    stubs; without `<!--@include-->` they render empty.
11. **Fix the GitHub edit link** — `app/docs/[[...slug]]/page.tsx:31`, prefix
    `apps/www/`. A regression from the port; `config.mts` had it right.
12. **Fix the four dead-domain links** (`introduction.mdx:86`,
    `open-questions.mdx:9,172,177`) and **`homepage` in both package.jsons**
    (A2, A3). Points at real destinations now; Phase 4 moves them to the final
    domain.
13. **Rewrite `principles.mdx:150-170`** for the post-deletion layout (E4).

### Phase 2 — The demo index (P1)

Small, unglamorous, and everything in Phase 3 depends on it. Scope discipline
matters here: this is a build-time index for the site, not a published protocol.

1. **Add `hello-world`'s missing `WIDGET_METADATA`** — 19/19 coverage, so the
   extraction step can be strict.
2. **Extract at build time** — walk `apps/playground/src/widgets/*`, read
   `WIDGET_METADATA` and `GRIST_OPTIONS`, read the source file, emit
   `{ id, title, description, requiredAccess, columns, source }`. Fail CI on a
   widget missing metadata.
3. **Add a `document` hint per widget** — which fixture from
   `data/document-examples.ts` best demonstrates it. `task-board` against the
   todo list, `attachment-gallery` against something with attachments. Without
   this, demos default to a document that makes them look broken.
4. **Rewire `data/widget-examples.ts`** to use the index — real titles in the
   playground picker instead of raw ids. First consumer, and it validates the
   index before the website depends on it.
5. **Curate what's public.** `v0-minimal` / `v1-minimal` / `v4-minimal` are
   versioned scratch demos. A `visibility` flag beats deleting them.

### Phase 3 — Presentation (P1)

1. **Add an `embed` mode to the playground**, rather than porting it into
   `apps/www`. A route or param that renders the document + widget panes with
   minimal chrome, sized for embedding. The playground stays the single
   implementation of the live rig; the site embeds a constrained view of it.
   See 3.1 below for why integration is the wrong direction.
2. **Build the demo component in `apps/www` around that iframe.** Split of
   responsibility:
   - **iframe (playground)** — document inspector + live widget. The half that
     needs the SDK and the real plugin API.
   - **www** — layout, captions, and **the code pane**, rendered from the Phase 2
     index with fumadocs' existing shiki highlighting.

   Rendering code in the parent rather than inside the iframe is the better
   split for three reasons: it looks identical to every other code block on the
   site, it stays selectable and copyable, and — most importantly for the agent
   path — **text inside an iframe is invisible to crawlers and to `llms.txt`**.
   Code in the parent document is not.
3. **Make it work small.** The full three panes need width. Decide the responsive
   story deliberately: tabs on mobile, side-by-side from `lg`. A demo that
   collapses badly is worse than a screenshot.
4. **Land the hero on it.** The landing page's job is one sentence, one copyable
   `npm create grist-widget`, and then **the live triptych immediately** — a
   real document, a real widget reacting to it, real code. Not a feature grid,
   not a static screenshot. Everything else on the page is secondary: the
   provider+boundary+`useGrist()` snippet (already written,
   `introduction.mdx:16-38`), the "why not the raw plugin API" table (already
   written, `packages/core/README.md:11-16`), and an **AI-native section**
   surfacing `/llms.txt`, `/llms-full.txt`, per-page markdown and `AGENTS.md` —
   all of which exist and none of which is currently advertised. Cap the type
   ramp at `text-6xl`/`md:text-7xl`.
5. **Give each demo a page** — `/demos/<id>` or `/examples/<id>`: the triptych,
   the `GRIST_OPTIONS` contract as a "what this needs" table, the copyable
   widget URL to paste into a real Grist doc, "open full playground", and
   copy-as-markdown for agents.
6. **Use the same component throughout the docs.** Every guide page that
   currently describes behavior in prose can show it instead — `reading-data`,
   `column-mapping`, `writing-data`, `error-handling` (flip access level and
   watch the boundary catch it) especially.
7. **Replace the pasted code in cookbook + cheat sheet** with the index-fed
   version, or fold them into the demo pages entirely. Dissolves E3 and removes
   ~2,500 duplicated lines.
8. **Resolve the naming collision (D2):** `/demos` = first-party, live ·
   `/widgets` = community directory (today's `/search`, renamed, with a
   redirect) · ⌘K = docs search · `/docs/registry` = "submit yours".
9. **Cut nav to four:** Demos · Widgets · Docs · GitHub.
10. **Group the 17 flat guide pages** into Concepts · Building · Advanced ·
   Reference.

#### 3.1 Why the playground should not be absorbed into `apps/www`

The tempting move is to port the playground's panes into Next.js so there is one
app. It should not be done, and the reason is in the repo's own comments.

**The iframe is not a wrapper — it is the product.** `apps/playground/widget.html`
loads the **real** plugin API from Grist's servers:

```html
<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
```

> "Production-faithful path: the iframe loads the actual Grist plugin API so
> widget code talks to `window.grist` exactly like in production. The emulator
> host (parent window) speaks `grain-rpc` over postMessage with this script."

`App.tsx` reinforces it: `widget.html` is deliberately *not* an SPA route, so the
browser does a real page load and "Grist's plugin script runs from scratch —
same load sequence as a real Grist embed."

So the demo's entire credibility rests on the widget being a separately-loaded
document running Grist's own script, talking over a real postMessage boundary.
Inline it into a React tree and you are demonstrating something that is not how
widgets work — and quietly losing the handshake, the boundary, and the claim
that the URL shown is the URL you paste into Grist.

**Therefore absorption can never be complete.** Even after porting the inspector
to Next.js, `widget.html` still has to be built by Vite. Integration doesn't
remove the second build — it keeps the second build *and* adds a port.

What that port would cost, concretely:

- ~1,150 lines of client-only React rewritten (shell, inspector, two pickers),
  plus React Router → Next routing.
- `apps/www` takes on a `grist-widget-sdk` dependency, breaking a boundary the
  repo maintains deliberately (README:58, `deploy-apps.yml`). Today an SDK
  change cannot break the docs deploy; afterwards it can.
- Both Vite configs alias `grist-widget-sdk` → `packages/core/src/**` (source,
  not `dist`) for live SDK edits. Next would need an equivalent, or lose that DX.
- `document-inspector.tsx` imports `GristRdgGrid` and `grist-rdg-columns` from
  `@/widgets/v4-minimal/` — the inspector depends on a widget demo, so
  `react-datasheet-grid` comes along too.

**The seam this avoids is smaller than it looks.** The usual argument for
merging is visual drift between the two apps. Verified: both `components.json`
files are already the *same* shadcn configuration — `radix-nova`, `neutral`,
CSS variables, lucide. And cross-boundary theming is a solved problem here
(`grist-document-theme-sync.tsx` already drives the iframe's theme from host
state, and the emulator exposes `emulator.theme` for the parent to set). Shared
tokens are worth verifying; a rewrite is not the way to get them.

**Conclusion:** keep two apps. Give the playground an embed mode, let it stay
the single implementation of the live rig, and let `apps/www` own the
presentation around it — including the code pane, which belongs in the parent
document for crawlers and agents rather than trapped inside the frame.

This also retires open question #2 from the previous revision: the playground and
the embedded demo are **not** two implementations. They are one implementation at
two sizes, plus a code pane only `apps/www` ever renders.

### Phase 4 — Domain migration to `gristwidgets.com` (P1)

DNS is already correct — verified: apex has all four Pages A records, `www` has
those plus AAAA. Only the repo side is missing. Sequence matters:

1. **Add the custom domain in Settings → Pages** (or commit a `CNAME` file into
   the artifact in `deploy-apps.yml`'s "Assemble site" step — more robust with
   the Actions-native flow since it can't be lost from the artifact). Decide apex
   vs `www` as canonical and redirect the other.
2. **Enable Enforce HTTPS** once GitHub provisions the certificate.
3. **Flip `basePath` to empty.** `deploy-apps.yml` currently sets
   `WWW_BASE=/${{ repo }}/` and `PLAYGROUND_BASE=/${{ repo }}/playground/`. On a
   custom domain these become `""` and `/playground/`. Both apps read these from
   env, so it's a workflow-level change — but the `/playground/…` links in the
   docs are basePath-relative and **must be re-verified in built HTML after the
   flip**, exactly as in Part 5.
4. **Set `WWW_SITE_URL=https://gristwidgets.com`** so `metadataBase`
   (`app/layout.tsx:17`) stops falling back to the github.io URL — otherwise
   every OG/twitter image resolves to the old origin.
5. **Update both `homepage` fields** (A3) to the real domain in the same change.
6. **Single source of truth for the domain.** It is currently hand-written in
   three files with two spellings. One constant, imported.
7. **Keep the github.io URL working** — it's in published npm READMEs and in the
   wild. GitHub redirects `<user>.github.io/<repo>` to the custom domain
   automatically; verify rather than assume, since the basePath change makes this
   the riskiest step in the plan.
8. Add the four apex **AAAA** records for IPv6 parity with `www`.

### Phase 5 — Content quality (P2)

1. **Rewrite all 30 duplicated descriptions and 13 truncated ones**, then delete
   the duplicated opening paragraph from each body. Each description must read
   correctly in four contexts: subtitle, `<meta>`, OG image, `llms.txt`.
2. **Fix `api/index.mdx` link text** (E5) — ~20 rows.
3. **Clean up `quickstart.mdx`** (E6).
4. **Give the ported `files/` pages a home** — the Phase 1.7 batch lands as raw
   ports; this is where they get a section (`/docs/contributing` or
   `/docs/internals`), consistent frontmatter, and cross-links.

### Phase 6 — SEO, agent surface, hygiene (P2–P3)

1. **Mirror `AGENTS.md` at `/docs/agents`** (the file itself lands in Phase 1.3).
2. **Restore the `llms.txt` curation** (B5) — a hand-written header above the
   generated index: the one-paragraph summary, canonical entry points, and the
   "For AI agents" section the old `public/llms.txt` had. The generated flat dump
   is a regression for exactly this project's audience.
3. **`app/sitemap.ts`, `app/robots.ts`, `app/icon.svg`, `app/not-found.tsx`**;
   OG images for `/`, `/demos`, `/widgets`; canonical URLs.
4. **Delete `lib/cn.ts`, drop `cnfast`** (G1); **rewrite `apps/www/README.md`** (G2).
5. **Harden the community registry fetch** (G3/G4) — build-time fallback
   snapshot, timeout, runtime shape validation before rendering `widgetUrl`.
6. **Link checker in CI.** Every finding in section A would have been caught by
   one, and A1 is the kind of thing that recurs on every content move. This is
   the durable fix, not the individual edits.

### Sequencing note

Phases 1 and 2 are independent and can run in parallel — 1 is content/link
repair, 2 is tooling. Phase 3 depends on 2. Phase 4 (domain) touches
`deploy-apps.yml`, which nothing else here does, so it can land any time after 1
— but doing it **before** Phase 3 matters more than it looks: the demo component
embeds `/playground/…` URLs, and those are exactly the basePath-relative links
the domain flip changes. Landing the domain first means authoring them once.

---

## Part 4 — Open questions for you

Two genuine forks where I'd rather flag than assume. (A third — whether the
playground merges into `apps/www` — is now answered in 3.1: it shouldn't.)

1. **How many live demos on one page?** Each triptych is an iframe running an
   emulator. One in the hero is clearly right. A grid of nineteen is clearly not.
   The usual answer is a static poster frame that goes live on interaction — but
   that needs a screenshot pipeline which can itself go stale, so it trades one
   drift problem for another. Alternative worth considering: one live demo plus a
   widget switcher, so the page holds a single running instance and swaps what's
   in it. Cheaper, and arguably shows the toolkit better than nineteen thumbnails.

2. **Is `/demos` a section or the front page?** If the live triptych really is
   the best thing the project has, the landing page may not need to be a separate
   page at all — the hero could *be* the demo, with the marketing copy arranged
   around it. More opinionated, harder to get right, and much stronger if it
   lands.

---

## Part 5 — Reproducing the findings

Link resolution, verified against built output:

```bash
WWW_BASE=/grist-widget-sdk/ pnpm --filter www build
cd apps/www/out
grep -o 'href="[^"]*getting-started[^"]*"' docs/sdk/guide/introduction/index.html
# → href="./getting-started"    (unrewritten; 404 under trailingSlash)
grep -o 'href="[^"]*concepts[^"]*"'        docs/sdk/guide/introduction/index.html
# → href="/grist-widget-sdk/docs/sdk/guide/concepts/"   (correctly rewritten)
```

Duplicated / truncated descriptions (30 and 13 hits):

```bash
cd apps/www
for f in $(find content/docs -name '*.mdx' | sort); do
python3 - "$f" <<'EOF'
import sys, re
p = sys.argv[1]; t = open(p).read()
m = re.match(r'---\n(.*?)\n---\n(.*)', t, re.S)
if not m: sys.exit()
fm, body = m.groups()
d = re.search(r'^description:\s*(.*)$', fm, re.M)
if not d: print('NO-DESC', p); sys.exit()
dv = d.group(1).strip().strip('"\'')
para = []
for l in body.split('\n'):
    if l.startswith(('import ', 'export ', '<')): continue
    if not l.strip():
        if para: break
        continue
    para.append(l.strip())
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())[:70]
flags = []
if norm(dv) and norm(dv) == norm(' '.join(para)): flags.append('DUP-FIRST-PARA')
if dv.rstrip().endswith((':', '…', '...')):       flags.append('TRUNCATED-DESC')
if flags: print(','.join(flags), p)
EOF
done
```

Block metadata coverage (18 of 19; `hello-world` is the gap):

```bash
cd apps/playground/src/widgets
for d in */; do grep -q WIDGET_METADATA "$d/WidgetApp.tsx" || echo "MISSING: $d"; done
```

Domain status:

```bash
python3 -c "
import socket
for h in ['grist-widgets.com','gristwidgets.com','www.gristwidgets.com','demo.grist-widgets.com']:
    try: print(h, sorted({i[4][0] for i in socket.getaddrinfo(h, None)}))
    except Exception as e: print(h, 'NO RECORD')
"
# grist-widgets.com      → NO RECORD          (4 doc links + 2 npm homepages point here)
# gristwidgets.com       → 185.199.108-111.153 (GitHub Pages apex, all four)
# www.gristwidgets.com   → same + AAAA
# demo.grist-widgets.com → Cloudflare (live)
```

Baseline: `apps/www` builds clean today — 112 static pages, TypeScript passes,
correct `basePath` and asset prefixing under `WWW_BASE`. Every change above
should preserve that.
