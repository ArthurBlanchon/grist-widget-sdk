# 0016. A Content Security Policy in every catalog widget's page

- **Status:** accepted
- **Date:** 2026-11-15
- **Amended:** 2026-11-21: scripts from the widget's own files only; each
  build ships a pinned copy of the plugin API (below)

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
- **The plugin API ships with the widget.** Each build writes
  `grist-plugin-api-<version>.js` next to its page and points the page's
  script at it (`_shared/plugin-api.mjs`, `_shared/vite.ts`): grist-static's
  `grist-plugin-api.js`, a build without eval, committed in
  `widgets/_shared/plugin-api/` with grist-static's licence, so a build
  needs no network. It is pinned by its sha512, checked at every build and
  by `check-widgets --sizes`, which leaves it out of the widget's size
  budget; a test checks it against grist-static's npm tarball, whose
  integrity is pinned. The pin is the catalog's own; the demo pages'
  grist-static version can move without it. A released version thus needs
  nothing from anywhere else, at any path, on any host (ADR 0013). The
  source `index.html` keeps `https://docs.getgrist.com/grist-plugin-api.js`
  once, for `pnpm dev`, which has no policy; `check-widgets` and the build
  fail without it.
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
  Grist. A file the widget doesn't ship can change under it. A copy served
  by the site, at a path that names a grist-static version, would have
  broken every release the day the site moved to the next version: hence a
  copy in each release.
- Each release carries the 842 KB file (165 KB gzipped), the weight
  docs.getgrist.com's file had before. Moving to a newer copy changes the
  pin and releases every widget; the real-Grist check runs the shipped
  file, so it sees the change.
- A released version speaks the plugin API of its copy to every later
  Grist, where docs.getgrist.com's file moved with Grist. That holds while
  Grist keeps its plugin protocol compatible, as it means to; the weekly
  run against the latest Grist (`widgets-latest-grist.yml`) sees a break,
  and a new copy reaches the widgets in their next release, not the
  versions already out. Newer calls (`reportWidgetErrors`) wait for a copy
  that has them.
- The policy reaches the `/dev/` channels from `main`; each widget carries
  it from its next release.
