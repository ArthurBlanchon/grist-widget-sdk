---
name: write-docs-page
description: Write, rewrite, move or retire a page of the grist-widget-sdk docs site (apps/www/content/docs). Use when asked to document a feature, fix or reorganise the docs, or when a behaviour change needs its docs page.
---

# Write a docs page

The site's rules are in [`apps/www/AGENTS.md`](../../../apps/www/AGENTS.md).
The target structure is in the
[documentation rewrite plan](../../../docs/planning/2026-11-14-docs-rewrite-plan.md).

1. **Pick the kind of page:**
   - a tutorial, which teaches by doing;
   - a guide, which answers one task;
   - reference, complete and dry;
   - an explanation, of how and why.

   Never mix two kinds. If it needs more than about 800 words, make it two
   pages.
2. **Write the current API only.** Use `defineGristWidget()`,
   `widget.useGrist()`, `mappedRecord`, `updateRecord`/`addRecord` and
   `renderWithGrist(<App />, { widget, rows })`. No deprecated names and no
   migration tables: the changelog is the history.
3. **Code compiles.** Every `tsx`/`ts` block becomes a test
   (`scripts/extract-doc-snippets.mjs`), run by
   `pnpm --filter grist-widget-sdk test`. Mark a fragment that can't
   compile with `no-check`, and use that sparingly. To show an example's
   code, include it from `examples/` rather than pasting it.
4. **Navigation.** Add the page to its folder's `meta.json`.
5. **A moved or retired page** gets a line in `scripts/site/redirects.mjs`
   in the same pull request. Update every link to it:

   ```bash
   grep -rn "<old path>" apps/www/content
   ```

6. **Check:**

   ```bash
   pnpm --filter grist-widget-sdk test
   pnpm --filter www build
   ```

   If you touched `scripts/site/`, also run
   `node --test scripts/site/*.test.mjs`.

Maintainer material (procedures, decisions, architecture) never goes on
the site: it belongs in `docs/` in the repository.
