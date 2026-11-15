# 0001. Two independent origins for the site

- **Status:** accepted
- **Date:** before 2026-11; recorded 2026-11-14

## Context

The docs site and the example widgets must be reachable from company networks. Some allow `github.io` and block unknown domains; others block `github.io` as user content and allow the rest.

## Decision

Publish the same site at two origins on two providers: GitHub Pages (`arthurblanchon.github.io/grist-widget-sdk/`) and Cloudflare Pages (`gristwidgets.com`). Neither redirects to the other, and `gristwidgets.com` is canonical for search engines.

## Consequences

- One build script, `scripts/build-site.mjs`, run twice with a different `SITE_BASE`. Next bakes the base path into its output, so one artefact cannot serve both.
- No `CNAME` on the GitHub Pages site: a custom domain there would redirect github.io to it.
- Cloudflare's build of each pull request is a preview and a second run of the build.
- Procedure: [site deploy](../operations/site-deploy.md).
