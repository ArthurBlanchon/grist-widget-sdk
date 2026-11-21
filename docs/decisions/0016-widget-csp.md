# 0016. A Content Security Policy in every catalog widget's page

- **Status:** accepted
- **Date:** 2026-11-15
- **Amended:** 2026-11-21: scripts from the widget's own origin only; the
  plugin API is grist-static's production copy (below)

## Context

A catalog widget renders a document's data, and some of it (a template, a
diagram, a cell's text) comes from people other than its reader. Lint and
`httpUrl()` keep data out of scripts and URLs; a policy in the page is the
second line, for what they miss. The plan to 0.8.0 (§3) asked for "a CSP in
a `<meta>` written by the build: `script-src 'self'` and Grist's plugin API
host, `connect-src` the hosts the spec declares".

## Decision

- **The build writes the policy** into each widget's page
  (`widgets/_shared/csp.mjs`, `_shared/vite.ts`), right after its
  `<meta charset>`, before every script. Builds only: the dev server needs
  its inline scripts. A `<meta>` can't set `frame-ancestors`; the site's
  headers handle framing (`scripts/site/headers.mjs`).
- **The base:** scripts from the widget's own origin only. No inline
  script, no eval.
- **The plugin API is a production build, served by the site.** The built
  page loads `grist-static/<version>/grist-plugin-api.js` from its own
  origin (`PLUGIN_API_BUILT`), the copy the site already serves for the
  demo pages: grist-static's, pinned by version and integrity
  (`scripts/site/grist-static.mjs`). The source `index.html` keeps
  `https://docs.getgrist.com/grist-plugin-api.js` for `pnpm dev`, which
  has no policy; the build replaces it, and fails without it. Styles its own
  and inline. Images, fonts, media and frames its own, `data:` and `blob:`.
  `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'none'`.
- **A spec adds what its widget needs,** in its front matter's `csp:`, to
  `connect-src`, `img-src`, `font-src`, `style-src`, `frame-src`,
  `media-src` or `object-src`: https hosts, or a scheme. Never to scripts.
- **`grist` stands for the document's own Grist server.** No build knows
  it, so it allows every http(s) origin; it is `connect-src`'s only
  wildcard, and bare `https:` or `http:` are refused there. Adding a host to
  `connect-src` is adding an outbound host (ADR 0012's row: the
  maintainer's go).
- **The code and the policy agree:** `check-widgets` requires
  `connect-src grist` from a widget that calls Grist's REST API
  (attachments, `fetchWithAuth`), and CARTO's hosts from one that draws a
  map; and refuses any outside script but the plugin API in the source page.
- **The e2e check fails on any refusal** in the widget's frames, the ones
  that inherit its policy (`srcdoc`, `blob:`) included.

## Consequences

- A widget with `connect-src grist` can still send data to any http(s)
  origin. The SDK could narrow it at run time (a second, stricter `<meta>`
  naming the origin of its access token), a later improvement.
- A module worker (the map's) takes its policy from its response's
  headers, which the site doesn't send: the worker runs outside the page's
  policy.
- Document template's templates load images, stylesheets and fonts over
  https, never scripts; iframes and video in a template are refused.
- Amended on 2026-11-21: docs.getgrist.com began serving its plugin API
  as a webpack development build, which runs its modules through `eval`.
  The policy refused it, `window.grist` was never defined, and every
  widget showed "The Grist plugin did not load", in the demos and in real
  Grist. A file the widget doesn't pin can change under it; grist-static's
  is pinned, and moving to a newer one is a change of
  `GRIST_STATIC_VERSION` that the real-Grist check sees.
- The e2e check serves the local Grist's own plugin API in place of both
  URLs, so it tests the widget, not a given copy of the file: the copy's
  own check is the site's integrity pin.
- The policy reaches the `/dev/` channels from `main`; each widget carries
  it from its next release.
