# 0013. A catalog widget's channels: one per major, and dev

- **Status:** accepted
- **Date:** 2026-11-15
- **Amends:** [ADR 0009](./0009-install-urls.md). The install URL shown is the
  major channel, not `/latest/`.

## Context

A Grist document keeps a widget's URL for years. With `/latest/` as the URL
it installs, a widget's next major version (a column removed, renamed or
retyped, a higher access) reaches every such document unannounced and can
break it. A pinned `/<version>/` never breaks, but it never gets a fix
either, a security fix included. The six reference repositories also had a
`/dev/` channel: what was merged but not released, checked in a real Grist
document before its release. The catalog had nothing like it.

## Decision

Each catalog widget is served on both origins at:

| Path | Serves | For |
| --- | --- | --- |
| `/widgets/<slug>/v<major>/` | The newest release of that major | **The install URL the catalog shows.** Every fix of the major, never a breaking change |
| `/widgets/<slug>/<version>/` | One release, never rebuilt | A document that must never change |
| `/widgets/<slug>/latest/` | The newest release of all | Kept for the URLs already pasted. No longer recommended |
| `/widgets/<slug>/dev/` | The source the site was built from: on `main`, merged but not released | Checking a change in a real Grist document before its release. **Never an install URL** |

A pull request's preview stays Cloudflare's build of its branch, where the
same paths serve that branch.

A breaking change to a widget takes a new major (`widgets/AGENTS.md`, ADR
0012). Its first release opens `/v<major+1>/` and leaves `/v<major>/` as it
was. The `0` major is a channel like the others: `/v0/` until 1.0.0.

## Consequences

- `scripts/widgets/dist.mjs` (`majorChannels`) and `scripts/build-site.mjs`
  make the channels on every build. `/dev/` adds one source build per widget
  to each site build, about 30 seconds for 16 widgets.
- Each channel is a copy of a release, so the site holds about two copies of
  each widget more. That is around 30 MB for 16 widgets, against the 1 GB
  budget.
- Every site build, `main`'s included, builds each widget from source for
  `/dev/`. A widget that doesn't build stops the site's deploy on both
  origins, as CI's `widgets` job would have stopped its pull request.
- A page opened outside Grist (`grist-widget-sdk/app`'s release page) reads
  `/v<major>/` as a channel and lists the releases from each widget's
  `versions.json`. On `/dev/` it says not to paste it into a document
  instead of offering the URL.
- Each widget's demo page runs its newest major's channel.
- The catalog pages to come (plan to 0.8.0, M2) show `/v<major>/` as the
  install URL.
