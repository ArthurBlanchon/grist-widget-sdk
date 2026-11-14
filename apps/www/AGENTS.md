# Agent guide: the docs site (`apps/www`)

The landing page and the user documentation, a static Next.js + fumadocs
export, assembled with the example widgets by `scripts/build-site.mjs` and
published at two origins ([site deploy](../../docs/operations/site-deploy.md)).
It does not depend on `grist-widget-sdk`, so an SDK change cannot break
its deploy.

## Rules for a docs page

The [documentation rewrite plan](../../docs/planning/2026-11-14-docs-rewrite-plan.md)
sets them; in short:
- **The current API only.** `defineGristWidget()`, `widget.useGrist()`,
  `mappedRecord`, `updateRecord`/`addRecord`,
  `renderWithGrist(<App />, { widget, rows })`. No deprecated names, no
  migration tables, no "before and after": the changelog keeps history.
- **One kind of page each:** a tutorial, a guide to one task, reference, or
  an explanation, never mixed.
- **Short pages,** about 800 words at most. One that needs more is two.
- **Code is quoted, not pasted.** A `tsx` or `ts` block is compiled as a
  test (`scripts/extract-doc-snippets.mjs` → `packages/core/tests/docs/`).
  Mark a fragment that can't compile with `no-check`. Show an example's
  code by including it from `examples/`.
- **Users only.** Maintainer material goes in the repository
  ([`docs/`](../../docs/)), never on the site.
- **A retired or moved page gets a redirect** in `scripts/site/redirects.mjs`.
- **A behaviour change ships with its page** in the same pull request.

## Commands

| Intent | Command |
| --- | --- |
| Dev server | `pnpm --filter www dev` |
| Build | `pnpm --filter www build` |
| Lint | `pnpm --filter www lint` |
| Type-check | `pnpm --filter www types:check` |

## Path map

| Concept | Path |
| --- | --- |
| Docs content | `content/docs/` |
| Navigation | `content/docs/meta.json` |
| Next configuration | `next.config.mjs` |
| The site build (both origins) | `../../scripts/build-site.mjs` |
| Redirects for retired pages | `../../scripts/site/redirects.mjs` |
| Response headers | `../../scripts/site/headers.mjs` |
| Docs snippets, compiled as tests | `../../scripts/extract-doc-snippets.mjs` |
