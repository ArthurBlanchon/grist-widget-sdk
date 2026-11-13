import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// This app is built twice, once per serving origin, by scripts/build-site.mjs
// (which derives WWW_BASE from its single SITE_BASE knob):
//
//   WWW_BASE=/grist-widget-sdk/  -> arthurblanchon.github.io/grist-widget-sdk/
//   WWW_BASE='' (or unset)       -> gristwidgets.com
//
// Two runs rather than one artifact because Next bakes the base path into
// emitted hrefs *and* into JS chunks — one build cannot be correct at both a
// subpath and a domain root. Both directions of getting this wrong have been
// shipped here: no prefix on the project site (assets resolve against the
// domain root and 404), and a prefix on the custom domain (assets resolve
// under a path that doesn't exist, links point off-domain).
//
// Next's `basePath` wants no trailing slash (unlike the Vite-style "/repo/"
// convention PLAYGROUND_BASE uses), so it's trimmed here rather than
// diverging the shared env convention. `basePath` also drives `assetPrefix`.
const rawBase = process.env.WWW_BASE ?? '';
const basePath = rawBase.replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  // Static hosts (GitHub Pages, Cloudflare Pages static mode) don't do the
  // extensionless-URL rewriting Vercel does; trailing slashes keep
  // `/docs/guide` resolving to `docs/guide/index.html` instead of 404ing.
  trailingSlash: true,
  ...(basePath ? { basePath } : {}),
  env: {
    // `basePath` only prefixes what Next itself emits — next/link hrefs and
    // asset URLs. Runtime `fetch()` from client components is untouched, so a
    // root-relative path like '/api/search' requests the DOMAIN root and 404s
    // under a project-site prefix. Exposing the value lets those call sites
    // prefix explicitly (see withBasePath in lib/shared.ts). Derived from the
    // same const as `basePath` above so the two cannot disagree.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default withMDX(config);
