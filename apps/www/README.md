# www

The `gristwidgets.com` landing page and docs site — Next.js (`output: export`,
static) + [Fumadocs](https://fumadocs.dev). Deploys to two independent
origins; see [site deploy](../../docs/operations/site-deploy.md) for why.

From the repo root: `pnpm --filter www dev` (or `pnpm dev` here). Static
export builds with `pnpm --filter www build`, but the deployable tree is
assembled by the root `node scripts/build-site.mjs`, not this build alone —
see Deploy notes for the difference.

## Layout

| Path | What's there |
| --- | --- |
| `content/docs/**` | All doc pages (`.mdx`). One sidebar in four sections (Get started, Guides, Reference, Concepts), from `content/docs/meta.json`, which lists every page by its path. |
| `app/(home)` | The landing page. |
| `app/docs` | The docs layout and `[[...slug]]` catch-all route. |
| `app/widgets` | The community widget registry browser. |
| `app/api/search` | The docs search route handler. |
| `lib/source.ts` | The Fumadocs content-source loader — frontmatter schema (length/uniqueness refinement), `<include>`/`AutoTypeTable` wiring. |
| `lib/layout.shared.tsx` | Shared top-nav options. |
| `components/mdx.tsx` | MDX component registration (`getMDXComponents`) — see it before adding a per-page `import` for a Fumadocs component; it may already be registered globally. |

## Generated at build time, not checked in

- `.generated/catalog.json` — via `prebuild`/`predev`, from
  `scripts/widgets/catalog.mjs`, reading `widgets/*/SPEC.md`.
- `sitemap.xml`, `robots.txt`, `icon`, `opengraph-image`, `/llms.txt`,
  `/llms-full.txt`, per-page `/llms.mdx/**/content.md` — Next.js file
  conventions + Fumadocs, all in `app/`.

## Docs authoring

- Every page needs frontmatter `description`, 40–160 chars, not a repeat of
  the page's own opening paragraph, unique across the whole corpus —
  enforced by a zod refinement in `lib/source.ts`, not just a convention.
- A whole widget is linked to in its catalog folder (`widgets/<slug>/`),
  never pasted; a `tsx`/`ts` snippet is compiled as a test.
- API reference tables use `<AutoTypeTable>` against real SDK types, not
  hand-written tables.
