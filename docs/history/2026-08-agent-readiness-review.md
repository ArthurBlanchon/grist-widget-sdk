# Agent-readiness & stack leverage — review, volume II — 2026-08-08

> **➜ The consolidated, sequenced plan is
> [`2026-08-execution-plan.md`](./2026-08-execution-plan.md)** — 67 findings, 33 PRs, 6
> phases. This file is the evidence behind it.
>
> **Companion to** [`2026-08-ecosystem-review.md`](./2026-08-ecosystem-review.md). Volume I
> asked whether a junior developer could ship a widget. This one asks whether an **agent**
> can — and whether the stack is already doing the work we are about to do by hand.
>
> **Lens:** AI-agent readiness · stack-native adoption.
> **Stack audited:** Fumadocs 16.14.0 / fumadocs-mdx 15.2.1 · shadcn 4.16.1 · Next 16.2.12 ·
> Vite 7 (apps) / 8 (core).
>
> **19 net-new findings** (64 across both volumes). Two Volume I findings are restated here
> because they belong to this lens.

---

## 1. Verdict

**Genuinely ahead — the artifacts exist.** A root `AGENTS.md` with an operating contract,
path map, decision tree and anti-patterns. `/llms.txt`, `/llms-full.txt`, per-page markdown
at `/llms.mdx/…/content.md`, copy-as-markdown on every page. A real Claude Skill with a
working driver script. A Cursor rule. Most repos this size have none of it.

**Two failures.**

*Incoherent.* The always-on Cursor rule points at `apps/docs/`, a directory that no longer
exists, and instructs agents to do two things CI actively rejects. Nothing checks that any
of these surfaces agree with each other or with the workflows.

*Under-leveraged.* `shadcn` is a dependency in all three apps with no `registry.json`;
Fumadocs' component library is used on three pages out of thirty-eight; there is no
Renovate or Dependabot, while eleven packages sit at different versions across four
workspaces.

---

## 2. The `AGENTS.md` question: three topics, one source

Two topics — monorepo and template — is right about the audiences you can see. It misses a
third, plus a delivery problem the repo already has a live bug in.

### Three audiences, not two

| Audience | Reaches you via | Needs to know | Today |
| --- | --- | --- | --- |
| **A · Contributors** | clones the monorepo | workspace layout, changesets, the public-API test, doc-with-behavior rule, release mechanics | Root `AGENTS.md` — exists, **stale** (points at `TASKS.md` and the retired root changelog) |
| **B · Widget authors** | "Use this template" → clone | the north-star pattern, no `window.grist`, `renderWithGrist`, the `/dev/` loop, the silent-no-op release rule | **Nothing.** This is the primary path and it has no agent file |
| **C · Never clones** | answering "how do I do X with this SDK" from anywhere | the API surface, current signatures, working recipes — on demand, not as a 7,800-line dump | A flat, ungroomed `/llms.txt`. **No MCP server.** |

Audience C is the one that scales. Every agent helping someone with an *existing* widget,
or answering a question in an editor with no repo open, is in this group — and it is the
only audience whose numbers grow without anyone scaffolding anything.

### And one source, not five files

`AGENTS.md` is the convergent cross-vendor convention, but vendor-specific files still win
where they exist: `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`,
`.cursor/rules/*.mdc`. Hand-writing all of them is five drift sources — and the failure is
already visible in this repo:

> **`.cursor/rules/iteration-workflow.mdc` is `alwaysApply: true` and it is wrong on three
> counts.** It tells every Cursor agent that the full workflow text is at `apps/docs/work.md`
> and that API changes update `/apps/docs/guide/` — `apps/docs` was deleted. It says "work on
> `main` unless the developer asks for a branch," while `require-changeset.yml` gates PRs into
> `main`. And it says add a `CHANGELOG.md` entry, which changesets now owns.
>
> An agent that follows this rule faithfully produces work that fails CI. Nothing in the repo
> notices, because nothing checks these files against each other.

So the shape is: **one authored source per audience** (A and B), **generated vendor files**
from it, and **a CI check that fails when they drift** — the same discipline
`public-api.test.ts` already applies to the SDK surface, pointed at agent config instead.
Audience C is served by MCP, generated from the same source.

> **On "Google OKF":** I could not identify a standard by that name, so I audited what I take
> it to mean — Gemini's `GEMINI.md` context convention, and Google-facing discovery
> (`sitemap.xml`, `robots.txt`, structured data, `.well-known`). None are present; all are
> covered below. If something specific was meant, point at it and it folds into A-07/F-09.

---

## 3. Primitives already paid for

Each row is in the dependency tree today, unused, and closes a Volume I finding that was
otherwise scheduled as custom work.

| Primitive | Already in | Closes |
| --- | --- | --- |
| **shadcn registry** — `registry.json` + `npx shadcn add <url>`, namespaced registries in `components.json` | shadcn@4.16.1, a dep in all 3 apps | **The entire Phase 3 `add` command.** We were going to build a registry protocol that ships with our UI library. |
| **shadcn registry MCP** — lets an agent search and install registry items | same package | Audience C, for widget recipes, with no server to write |
| **Fumadocs file transclusion** (`<include>`) | fumadocs-mdx@15.2.1 | W-12 — 2,575 hand-copied lines that falsely claim to be type-checked |
| **`fumadocs-typescript` · `AutoTypeTable`** — tables generated from real TS types | not installed; one `pnpm add` | The API reference drifting from 91 exports pinned only by a string list |
| **Frontmatter zod schema** in `defineDocs` | already imports `pageSchema` | W-06/W-07 permanently — a length + uniqueness refinement makes 28 duplicated and 13 truncated descriptions unrepresentable |
| **Next.js file conventions** — `sitemap.ts`, `robots.ts`, `icon.tsx`, `not-found.tsx`, `opengraph-image.tsx` | next@16.2.12 | W-13, all five, one small file each |
| **Renovate or Dependabot** | GitHub-native, config-only | "Stay up to date" currently has no mechanism at all |

The shadcn registry row is the one to sit with. Volume I argued the unit of reuse in this
domain is a whole widget, and that the shadcn model fits. It fits so well that **the
mechanism is already installed** — a `registry.json` describing
`apps/playground/src/widgets/*`, and `npx shadcn add @grist/form-edit` works, with a
registry MCP server for agents included. Phase 3 shrinks from "build a registry and a CLI"
to "write a manifest."

> **Version-check before building on two of these:** confirm `<include>` against the
> installed fumadocs-mdx 15.2.1 (`LANDING-DOCS-PLAN.md` assumed no equivalent existed, which
> may have been true of a different mechanism), and confirm the registry MCP entry point
> against shadcn 4.16.

---

## 4. Findings

### Agent surface

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| A-01 | **The always-on Cursor rule points at a deleted directory.** `alwaysApply: true`, and it names `apps/docs/work.md` as the full workflow text and `/apps/docs/guide/` as where API changes get documented. `apps/docs` no longer exists. | `.cursor/rules/iteration-workflow.mdc:8,19` | P0 |
| A-02 | **The same rule instructs agents to do two things CI rejects** — work directly on `main` (gated by `require-changeset.yml`) and hand-edit `CHANGELOG.md` (owned by changesets). A faithful agent produces a red PR. | `.cursor/rules/…:17,20` | P0 |
| A-03 | **The template ships no agent file.** Restated from T-10 — under template-first this is the primary path's biggest gap. | `templates/…` — none | P0 |
| A-04 | **Five agent-config surfaces, no consistency check.** Nothing in CI compares `AGENTS.md`, the Cursor rule, and the workflows — which is why A-01 and A-02 went unnoticed. | no check in `.github/workflows` | P0 |
| A-05 | **No MCP server** for the SDK or the docs. Audience C — every agent that never clones the repo — gets a flat `llms.txt` and nothing queryable. | no `.mcp.json`, no `/mcp` route | P1 |
| A-06 | **Root `AGENTS.md` is stale in the same two places.** It sends agents to `TASKS.md` for what to build and to the retired root `CHANGELOG.md` for user-visible changes. | `AGENTS.md:13,20` | P1 |
| A-07 | **No `CLAUDE.md`, `GEMINI.md`, or `.github/copilot-instructions.md`.** `AGENTS.md` is the convergent standard, but vendor files still take precedence where present, and nothing declares the mapping. | repo root, `.github/` | P1 |
| A-08 | **Skills exist only for maintainers.** The one Skill drives a live deploy check for this repo. Nothing ships to widget authors — where "scaffold a widget that does X", "add a recipe", "cut a release" are the repeatable tasks. | `.claude/skills/` — 1 skill | P2 |
| A-09 | **No GitHub-native agent surfaces** — no PR template, no issue templates, no `CODEOWNERS`. These are what Copilot-class agents and drive-by contributors read first. | `.github/` holds only `workflows/` | P2 |
| A-10 | **`.claude/launch.json` covers only `www`.** No configuration for the playground or the template, the two apps an agent is most likely to need running. | `.claude/launch.json` | P3 |

### Stack leverage

| ID | Finding | Evidence | Sev |
| --- | --- | --- | --- |
| F-01 | **The shadcn registry is unused.** `shadcn` is a dependency in all three apps and there is no `registry.json` anywhere. The registry protocol, the `add` command and the registry MCP server are the Phase 3 deliverable, already installed. | no `registry.json` in repo | P0 |
| F-02 | **`shadcn` is in `dependencies`, not `devDependencies`, in all three apps** — so a CLI ships in the production dependency tree of every scaffolded widget. At three different versions: 4.3.1, 4.4.0, 4.16.1. | `www:24`, `playground:29`, `template:25` | P1 |
| F-03 | **Fumadocs' component library is essentially unused.** Across 38 pages and 7,823 lines: `<Tabs>` twice, `<Steps>` twice, `<Callout>` twice, and zero `TypeTable`, `Files`, `Accordion` or `Banner`. The 2,575-line cookbook and cheat sheet are plain fenced blocks. | 3 component imports in `content/` | P1 |
| F-04 | **No file transclusion.** fumadocs-mdx ships an `<include>` mechanism; the docs hand-copy playground sources instead — the direct cause of W-12 and of a claim in both files that is not true. | no `<include>` in `content/` | P1 |
| F-05 | **`fumadocs-typescript` is not installed.** The API reference is hand-written tables covering a 91-symbol surface, pinned only by a string list in a test. `AutoTypeTable` generates them from the types themselves. | absent from `apps/www` deps | P1 |
| F-06 | **Frontmatter uses the stock `pageSchema` with no refinement.** No constraint on description length or uniqueness — exactly how 28 duplicated and 13 truncated descriptions got in and stayed. | `lib/source.ts:8` | P1 |
| F-07 | **No Renovate, no Dependabot.** "Stay current with the ecosystem" has no mechanism — and eleven packages sit at different versions across four workspaces, including React, Vite, TypeScript and Tailwind. | no `dependabot.yml` / `renovate.json` | P1 |
| F-08 | **Major-version drift inside one workspace.** `typescript` ^6.0.3 in www vs ~5.9.3 elsewhere; `vite` ^8.0.9 in core vs ^7.3.1 in both apps; `@vitejs/plugin-react` ^6 vs ^5. The SDK is built and tested on a different major than the code consuming it. | 4 `package.json` files | P1 |
| F-09 | **Five Next.js file conventions unused** — `sitemap.ts`, `robots.ts`, `icon.tsx`, `not-found.tsx`, `opengraph-image.tsx`. Restated from W-13, now with exact filenames; each is a single small file. | `apps/www/app/` | P2 |
| F-10 | **MDX components are imported per page** rather than registered once in `getMDXComponents`, which returns bare `defaultMdxComponents`. Every page wanting Tabs re-imports them, and no page can use a shared custom component. | `components/mdx.tsx` | P2 |
| F-11 | **Three different Node stories, none pinned.** No `.nvmrc` or `.node-version`; root `engines` says `>=22`, `packages/core` says `>=18`, CI uses 22. | `package.json` ×2, no version file | P3 |

---

## 5. What this changes in the plan

The phases hold. Three get cheaper, and Phase 0 grows a section it should have had.

### Phase 0 — add: repair the agent config before anything reads it · +2 days

Volume I's Phase 0 was "stop shipping untrue statements" to humans. The same defect class
exists in the files agents obey, and it is worse there — a human notices a broken link, an
agent acts on it.

- Fix or delete the Cursor rule's `apps/docs` references, its work-on-`main` instruction,
  and its changelog instruction. — A-01, A-02
- Bring root `AGENTS.md` in line with changesets and the real task tracker. — A-06
- Move `shadcn` to `devDependencies` in all three apps and align the version. — F-02

### Phase 1 — 1b becomes "author two sources, generate the rest" · unchanged scope

- Author `AGENTS.md` for audience A (monorepo) and audience B (template).
- Generate `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` and the Cursor rule
  from them, and add a CI check that fails on drift. This is the mechanism that prevents
  A-01 from recurring. — A-04, A-07
- Ship 2–3 Skills *in the template*: add a recipe, cut a release, debug the handshake.
  Skills are how a repeatable task survives contact with a fresh agent session. — A-08

**Note:** the template's `AGENTS.md` must be generated or CI-checked against the SDK, not
hand-written — otherwise it drifts exactly as the cookbook did, with higher stakes, because
it shapes every widget in the ecosystem.

### Phase 3 — shrinks from "build a registry" to "write a manifest" · −2 weeks

- Adopt the shadcn registry rather than building an `add` command: `registry.json` over
  `apps/playground/src/widgets/*`, installable with `npx shadcn add`, agent-installable via
  the registry MCP. — F-01, A-05
- Generate the cookbook with Fumadocs `<include>` against the same widget sources, so the
  type-checked claim becomes structurally true. — F-04
- Regenerate the API reference with `AutoTypeTable` so it tracks the types instead of a
  string list. — F-05

### Phase 4 — discovery is five files, not a project · −3 days

- `sitemap.ts`, `robots.ts`, `icon.tsx`, `not-found.tsx`, `opengraph-image.tsx`. — F-09
- Add the frontmatter refinement in `defineDocs` in the same PR as the description rewrite,
  so Phase 0's sweep can never be undone. — F-06
- Register shared MDX components once in `getMDXComponents`, then actually use Fumadocs'
  component set in the guide. — F-03, F-10

### Phase 5 — add: a mechanism for staying current · +1 day

- Renovate or Dependabot with grouped, auto-merged patch updates — the only way "up to date
  with the ecosystem" survives a busy month. — F-07
- Converge the four workspaces onto one TypeScript, one Vite, one React major; pin Node with
  `.nvmrc` and make `engines` agree. — F-08, F-11

---

## 6. The through-line

Volume I found a project whose hardest engineering was already done and pointed away from
the new user. This volume finds the same pattern one level down: the mechanisms that would
make this ecosystem agent-native are, with two exceptions, **already installed**. The
registry is in `shadcn`. The transclusion is in `fumadocs-mdx`. The discovery files are five
Next.js conventions. The consistency check is the same idea as the public-API test already
written.

The two genuine builds are an MCP server for audience C, and the generation-plus-check
pipeline for agent config. Everything else on this list is adoption, and adoption is
measured in days.

One caution to carry into Phase 1: an `AGENTS.md` is a document that tells agents what is
true about the code, which makes it the same species of artifact as the cookbook — and the
cookbook drifted, silently, while claiming it could not. Do not hand-write the template's
copy. Generate it, check it, or it will be wrong within two releases and every widget in the
ecosystem will inherit the error.
