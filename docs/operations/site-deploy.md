# Site deploy

> Read this before touching `scripts/build-site.mjs`, `scripts/site/`,
> `.github/workflows/deploy-apps.yml`, `retry-deploy-pages.yml`,
> `site-headers.yml` or the Cloudflare Pages project. This is the docs
> site's deploy, not a widget's: a widget's deploy is `grist-widget-deploy`
> (`packages/create-grist-widget/src/deploy.mjs`).

## Two origins, on purpose

The site is published at two independent origins, each with a complete
copy: the docs, the example widgets and their demo pages. The decision and
its reasons are [ADR 0001](../decisions/0001-two-site-origins.md).

| Origin | Host | `SITE_BASE` |
| --- | --- | --- |
| `https://arthurblanchon.github.io/grist-widget-sdk/` | GitHub Pages | `/grist-widget-sdk/` |
| `https://gristwidgets.com/` | Cloudflare Pages | unset (the domain root) |

- **Neither redirects to the other.** Some company networks allow
  `github.io` and block unknown domains; others do the reverse.
- **`gristwidgets.com` is canonical.** Both builds emit
  `<link rel="canonical">` pointing at it.
- **No `CNAME` is ever written.** A custom domain on the GitHub Pages
  site would make GitHub redirect the `github.io` URL to it, merging the
  two origins into one.
- **Two build runs.** Next bakes the base path into its links and JS
  chunks, so one build cannot serve both a subpath and a domain root.

## The build script

Both origins run `scripts/build-site.mjs`, which assembles `./site`:

| Path | What |
| --- | --- |
| `/` | `apps/www`: the landing page and `/docs/*` |
| `/examples/<id>/latest/` | the example widget |
| `/examples/<id>/demo/` | the example in a real Grist, from static files: grist-static and the committed `examples/_demos/<id>.grist` |
| `/grist-static/<version>/` | the pinned grist-static, used by the site's and every widget's demo pages |
| `/template-preview/` | the template's own build |
| old URLs | one-line pages that send to where a page moved (`scripts/site/redirects.mjs`) |

```bash
node scripts/build-site.mjs                                # gristwidgets.com
SITE_BASE=/grist-widget-sdk/ node scripts/build-site.mjs   # github.io
```

`SITE_BASE` is the only base setting. The script derives every other base
from it (`WWW_BASE` for Next, each example's Vite `base`, the grist-static
path of the demo pages), so they cannot disagree.

It also writes:
- **`.nojekyll`**, without which GitHub Pages drops `_next/`.
- **`_headers`**, the response headers Cloudflare Pages sends; GitHub
  Pages ignores the file. They come from `scripts/site/headers.mjs`:
  - **everywhere:** HSTS, `nosniff`, and a `strict-origin-when-cross-origin`
    referrer policy;
  - **docs pages:** framed by the site only, and no camera, microphone or
    location;
  - **`/examples/*` and `/template-preview/*`:** without those two, since
    Grist documents embed them;
  - **`/grist-static/*`:** readable cross-origin.

  `.github/workflows/site-headers.yml` checks what gristwidgets.com
  actually serves (`scripts/site/check-headers.mjs`), after each deploy and
  weekly.

### grist-static

The site serves one pinned grist-static version. The build downloads its
npm tarball, checks it against the integrity pinned in
`scripts/site/grist-static.mjs`, and copies `dist/` without source maps
(about 90 MB, 1,500 files). It is not a workspace dependency: at 188 MB it
would weigh on every install. A new version is a change to
`GRIST_STATIC_VERSION` and a new line in `GRIST_STATIC_INTEGRITY`.

### The examples' demo documents

They are committed under `examples/_demos/`, because the Cloudflare build
has no Docker to generate them:
- `node scripts/example-demos.mjs build` regenerates them in a real Grist
  (Docker);
- CI's `node scripts/example-demos.mjs check` fails when an example's
  columns, access or title changed since its document was made.

## The GitHub Pages origin

`.github/workflows/deploy-apps.yml` runs the script with
`SITE_BASE=/<repo>/` on every push to `main` that touches `apps/www/**`,
`packages/core/**`, `examples/**` or `scripts/**`, and on demand. It
publishes with `actions/upload-pages-artifact` and `actions/deploy-pages`.

The repository's settings must stay as they are:
- Settings → Pages → Source is **GitHub Actions**;
- the custom domain field is **empty**.

`concurrency: { group: "pages", cancel-in-progress: false }` keeps one
deployment in flight at a time.

`deploy-pages` sometimes stalls on GitHub's side and is cancelled. The
deploy step has a 15-minute timeout, and `.github/workflows/retry-deploy-pages.yml`
re-runs the failed jobs once, reusing the uploaded artefact. A second
failure is left for a person.

## The Cloudflare Pages origin

A Pages project on this repository serves `gristwidgets.com`:
- **build command:** `pnpm install --frozen-lockfile && node scripts/build-site.mjs`;
- **output directory:** `site`;
- **no `SITE_BASE`.**

It also builds every pull request. That build is both a preview and a
second, independent run of the site build.

Common errors:
- **"No projects matched the filters":** a `--filter` value doesn't match
  a `package.json` name.
- **"Output directory … not found":** the root directory and the output
  path repeat each other.
- **"Cannot find module 'grist-widget-sdk'":** build the SDK first in the
  same command.
- **"No Wrangler configuration file found":** expected for a static
  site.

The origins deploy on separate triggers, so one can lag the other by a few
minutes. Neither depends on the other, so a failed deploy leaves the
previous good build in place.

## The base-path trap

It has been shipped wrong both ways:
- **Too little prefix:** on github.io every asset 404s, and the page is
  white.
- **Too much prefix:** on gristwidgets.com, assets point at
  `/grist-widget-sdk/_next/…` and links leave the domain.

Serving `out/` locally catches neither, because localhost is a domain
root. Check the built output instead:

```bash
node scripts/build-site.mjs
grep -o 'href="[^"]*_next[^"]*"' site/index.html | head -2
# expect /_next/…; a /grist-widget-sdk/ prefix here is the bug

SITE_BASE=/grist-widget-sdk/ node scripts/build-site.mjs
grep -o 'href="[^"]*_next[^"]*"' site/index.html | head -2
# expect /grist-widget-sdk/_next/…; a bare /_next/ here is the bug
```

## Before changing deploy settings

- Workspace names still match the commands.
- The hosts' output paths still match the build's output.
- Nothing refers to a removed directory.
- After a base-path or domain change, check the built output's asset
  prefixes (above) before merging.

## History

The site once deployed from three workflows pushing to one `gh-pages`
branch, which queued GitHub's own Pages deployments behind each other.
`apps/docs` (VitePress) and `apps/web` (a Vite landing page) were replaced
by `apps/www`. A `/template/` showcase on this repository's Pages was
removed: the template's only live copy is
[`grist-widget-template`](https://github.com/ArthurBlanchon/grist-widget-template),
kept by `template-canary.yml` ([releasing](./releasing.md)).
