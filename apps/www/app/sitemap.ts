import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { siteUrlFor } from '@/lib/shared';

// Required for `output: export` (see next.config.mjs) -- otherwise the
// build fails collecting page data for this route.
export const revalidate = false;

// Static top-level routes this app itself serves. Not /examples/* or
// /grist-static/*: those are separate builds assembled alongside this one by
// scripts/build-site.mjs (widgets and their demos), not crawlable content.
const STATIC_ROUTES = ['/', '/widgets'];

export default function sitemap(): MetadataRoute.Sitemap {
  const docRoutes = source.getPages().map((page) => page.url);

  return [...STATIC_ROUTES, ...docRoutes].map((route) => ({
    url: siteUrlFor(route),
    lastModified: new Date(),
  }));
}
