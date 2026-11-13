export const appName = 'grist-widget-sdk';

// Two origins serve this site (see scripts/build-site.mjs), and metadata has to
// distinguish them:
//
//   siteUrl         where THIS build is served. OG images point here, so link
//                   previews for a URL work even if the other origin is down.
//                   Includes the base path and has no trailing slash, so
//                   `${siteUrl}${'/og/...'}` concatenates correctly.
//   canonicalOrigin which copy is AUTHORITATIVE. Both builds emit the same
//                   canonical so search engines index one copy while readers
//                   can browse either.
//
// Server-only: these are read at build time and this module is imported solely
// by server components and route handlers.
export const siteUrl = (process.env.WWW_SITE_URL ?? 'https://gristwidgets.com').replace(/\/$/, '');
export const canonicalOrigin = (
  process.env.WWW_CANONICAL_ORIGIN ?? 'https://gristwidgets.com'
).replace(/\/$/, '');

function absoluteUrl(origin: string, route: string): string {
  const path = `/${route.replace(/^\/+|\/+$/g, '')}`;
  return `${origin}${path === '/' ? '/' : `${path}/`}`;
}

/**
 * Absolute canonical URL for a route, with the trailing slash `trailingSlash:
 * true` makes authoritative. Built explicitly rather than left for Next to
 * resolve: Next only normalizes a URL it recognizes as internal, i.e. one
 * sharing metadataBase's origin — which is true on the canonical origin's own
 * build and false on the other's, so the two would otherwise disagree about
 * the trailing slash and one would point at a URL that redirects.
 */
export function canonicalUrl(route: string): string {
  return absoluteUrl(canonicalOrigin, route);
}

/**
 * Absolute URL for a route on THIS build's own origin (unlike canonicalUrl,
 * which always points at gristwidgets.com). A sitemap/robots.txt has to list
 * URLs on the same host it's served from -- crawlers reject or ignore
 * cross-origin entries -- so the github.io build's sitemap must list
 * github.io URLs, not the canonical ones.
 */
export function siteUrlFor(route: string): string {
  return absoluteUrl(siteUrl, route);
}
/**
 * Prefix a site-absolute path with the deployment's base path.
 *
 * Needed anywhere a URL is used by client-side code at runtime — `fetch()`,
 * or an href handed to a third party — because Next's `basePath` only rewrites
 * what it emits itself (next/link, assets). A bare '/api/search' resolves
 * against the DOMAIN root, which 404s on the github.io project site while
 * working fine at the Cloudflare domain root: a bug that only appears on one
 * of the two origins.
 *
 * Set from next.config.mjs's own `basePath`, and `NEXT_PUBLIC_`-prefixed so
 * the value is inlined into client bundles rather than read at runtime.
 */
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

export function withBasePath(path: string): string {
  return `${basePath}${path}`;
}

export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

export const gitConfig = {
  user: 'ArthurBlanchon',
  repo: 'grist-widget-sdk',
  branch: 'main',
};
