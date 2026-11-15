import type { MetadataRoute } from 'next';
import { source } from '@/lib/source';
import { siteUrlFor } from '@/lib/shared';
import { getCatalog } from '@/lib/catalog';

// Required for `output: export` (see next.config.mjs) -- otherwise the
// build fails collecting page data for this route.
export const revalidate = false;

// Static top-level routes this app itself serves, and a page per catalog
// widget (/widgets/<slug>/). Not /examples/*, /grist-static/* or a widget's
// channels: those are separate builds assembled alongside this one by
// scripts/build-site.mjs (widgets and their demos), not crawlable content.
const STATIC_ROUTES = ['/', '/widgets'];

export default function sitemap(): MetadataRoute.Sitemap {
  const docRoutes = source.getPages().map((page) => page.url);
  const widgetRoutes = getCatalog().map((widget) => widget.path);

  return [...STATIC_ROUTES, ...widgetRoutes, ...docRoutes].map((route) => ({
    url: siteUrlFor(route),
    lastModified: new Date(),
  }));
}
