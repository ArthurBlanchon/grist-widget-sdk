import { loader } from 'fumadocs-core/source';
import { docsContentRoute, docsImageRoute, docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { lucideIconsPlugin } from 'fumadocs-core/source/plugins/lucide-icons';

/**
 * Approximates the page's first prose paragraph from its raw .mdx source --
 * skips the frontmatter block, `import`/`export` statements, headings, and
 * JSX/fenced blocks. Good enough to catch a description that is a verbatim
 * copy-paste of the opening paragraph (the defect this schema exists to
 * make unrepresentable); it is not a full MDX parse.
 */
function extractFirstBodyParagraph(source: string): string {
  const body = source.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const paragraph: string[] = [];

  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      if (paragraph.length > 0) break;
      continue;
    }
    if (line.startsWith('import ') || line.startsWith('export ')) continue;
    if (line.startsWith('#') || line.startsWith('<') || line.startsWith('```')) {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line);
  }

  return paragraph.join(' ').replace(/\s+/g, ' ').trim();
}

function normalizeForComparison(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/, '')
    .toLowerCase();
}

// Tracks every description seen so far in this build/dev-server process,
// keyed by its normalized text -> the first page path that used it. Keyed
// by path (not a boolean/count) so re-validating the same file -- Next's
// dev server re-renders a page on every request -- can never flag itself as
// a duplicate of itself; only a *different* path reusing the same text
// trips the check. Resets on every fresh process, which is fine: a stale
// entry can only under-report a duplicate across separate builds, never
// invent one.
const seenDescriptions = new Map<string, string>();

const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // A schema factory, not a plain schema -- fumadocs-mdx's macro transform
    // only requires `dir`/`files`/`async` to be statically analyzable and
    // explicitly says dynamic logic belongs in `schema`. `pageSchema` is
    // still the base (imported, not replaced); this only adds refinements
    // that make W-06/W-07's defects (duplicated, truncated, and
    // body-echoing descriptions) fail the build instead of drifting back in.
    schema: ({ path, source }) =>
      pageSchema.superRefine((data, ctx) => {
        const description = data.description?.trim();

        if (!description) {
          ctx.addIssue('description is required in frontmatter');
          return;
        }

        if (description.length < 40 || description.length > 160) {
          ctx.addIssue(
            `description must be 40-160 characters (got ${description.length}) -- write a genuine one-sentence summary, not the page's opening paragraph`,
          );
        }

        if (/(\.\.\.|…)\s*$/.test(description)) {
          ctx.addIssue('description must not end in "..." or "…" -- it reads as a truncated auto-scrape, not a summary');
        }

        if (description.includes('\n')) {
          ctx.addIssue('description must be a single line');
        }

        const firstParagraph = extractFirstBodyParagraph(source);
        const normalizedDescription = normalizeForComparison(description);
        if (
          firstParagraph &&
          normalizeForComparison(firstParagraph).startsWith(normalizedDescription.slice(0, 60))
        ) {
          ctx.addIssue(
            "description must not repeat the page's opening paragraph verbatim -- the body already says it once; write a distinct summary for the subtitle/meta/OG/llms.txt reuse",
          );
        }

        const existingPath = seenDescriptions.get(normalizedDescription);
        if (existingPath && existingPath !== path) {
          ctx.addIssue(
            `description duplicates the one on "${existingPath}" -- every page needs a distinct summary, since it's reused as the subtitle, meta description, OG card, and /llms.txt entry`,
          );
        } else {
          seenDescriptions.set(normalizedDescription, path);
        }
      }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  // Resolves each space's meta.json `icon` string (a Lucide icon name) into
  // a real icon element -- the docs sidebar's tab dropdown (six spaces,
  // wired via getLayoutTabs in app/docs/layout.tsx) renders it next to the
  // space's title and description.
  plugins: [lucideIconsPlugin()],
});

export function getPageImageUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'image.png'];

  return {
    segments,
    url: '/' + [page.locale, ...docsImageRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

export function getPageMarkdownUrl(page: (typeof source)['$inferPage']) {
  const segments = [...page.slugs, 'content.md'];

  return {
    segments,
    url: '/' + [page.locale, ...docsContentRoute.split('/'), ...segments].filter(Boolean).join('/'),
  };
}

export async function getLLMText(page: (typeof source)['$inferPage']) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title} (${page.url})

${processed}`;
}
