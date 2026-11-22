# 0025. Hosting that holds at 100 widgets

- **Status:** proposed (drafted 2026-11-22, for the maintainer's decision)
- **Date:** 2026-11-22
- **Amends, once accepted:** [ADR 0013](./0013-widget-channels.md) (a
  released version is kept for good)

## Context

Both origins serve one static tree
([ADR 0001](./0001-two-site-origins.md),
[site deploy](../operations/site-deploy.md)). It holds:
- the docs;
- grist-static for the demo pages: **89 MB in 1,501 files**;
- every catalog release ever made, from `widgets-dist`, never rebuilt
  ([ADR 0013](./0013-widget-channels.md)): **131.5 MB in 1,899 files** on
  2026-11-22, a week after the first releases, for 16 widgets.

A release repeats what the one before it shipped:
- the five Geist font files;
- Grist's plugin API, 842 KB, since ADR 0016's amendment;
- most of its chunks, when only a widget's own code changed.

Mermaid diagram alone is 38 MB in 9 versions, the map 22 MB in 8.

The limits are GitHub Pages' 1 GB per site and Cloudflare Pages' 20,000
files. `scripts/site/budget.mjs` warns at 60 % of either and fails past
it. At 100 widgets released monthly, each release 1 to 5 MB and about ten
files, the site passes 60 % of the bytes within the first year, and the
files limit soon after. The factory would then stop releasing.

## Options

1. **Keep fewer versions, by semver.** Each major keeps its newest
   release, and each minor its newest patch. An older patch's folder
   becomes one small page that sends to the same major's channel, which is
   compatible by definition. Documents on `/v<major>/` see nothing. One
   pinned to a superseded `/<version>/` moves to the channel's newest. The
   size grows with the number of minors, not of releases.
2. **Serve identical files once.** The site build stores each file once by
   its hash, and each release's page points at the shared copy. This is
   the biggest saving: fonts, the plugin API and shared chunks. But a
   released page's bytes change after its release, so its folder is no
   longer exactly what was released. And GitHub Pages has no rewrite to do
   it without changing them.
3. **Move the releases to object storage** (Cloudflare R2, or a release
   asset per version), with the channels left on Pages. This scales
   without a limit. But it drops one of the two independent origins for
   pinned versions (ADR 0001) and adds a service, a bill and credentials.
4. **Load grist-static from a CDN** (jsDelivr, from npm, pinned with its
   integrity) instead of serving its 1,501 files. It frees 89 MB and 7.5 %
   of the files limit at once. The demo pages then depend on that CDN.

## Proposed decision

- **Option 1 now,** applied by the site build: the `widgets-dist` branch
  keeps every release (its history), and the site serves the kept ones.
  The pruned ones are listed in `/widgets/<slug>/versions.json` with the
  channel they send to. ADR 0013's "a released version is served for
  good" becomes "a released version stays installable: it, or its major's
  newest release".
- **Option 4 investigated,** as a TODO item: it is decided on its own
  numbers (the CDN's file and package limits, and the demo pages'
  integrity checks).
- **Options 2 and 3 not taken** while option 1 keeps the budget under
  60 %. They come back if it doesn't: 3 when the catalog passes 60
  widgets ([the size check at 30 and 60](../planning/2026-11-15-plan-0.8.md#6-after-080)).
- **The budget's trend** (bytes and files per deploy) goes into the
  site-deploy runbook, and `release-widgets` reports it.

## Consequences

- A document pinned to `/0.3.1/` moves to `/v0/`'s newest after a later
  patch of the same minor. This is the only behaviour change. A widget's
  catalog page says so, and says to install from the channel.
- The size follows the minors released, not the patches: at 100 widgets
  with a minor a quarter, about 400 folders a year instead of about 1,200.
- `widgets-dist` keeps the complete history, so a pruned version can be
  restored by building the site with it kept.
- Undecided points, for the maintainer:
  - whether a pinned superseded version may move to the channel at all,
    or must keep its folder (then option 2 is needed);
  - the CDN in option 4.
