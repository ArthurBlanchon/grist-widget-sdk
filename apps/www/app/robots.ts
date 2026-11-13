import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/shared';

// Required for `output: export` (see next.config.mjs) -- otherwise the
// build fails collecting page data for this route.
export const revalidate = false;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    // A literal file, not a page route -- siteUrlFor() would append the
    // trailing slash every page route gets, turning this into
    // /sitemap.xml/ (wrong; it's a generated file, not a directory index).
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
