# 0009. Install URLs on gristwidgets.com

- **Status:** accepted
- **Date:** 2026-11-14

## Context

A widget's URL, once pasted into a Grist document, is kept for years. The github.io address depends on the account and repository names; a domain of ours can be pointed at any host.

## Decision

The catalog shows `https://gristwidgets.com/widgets/<slug>/latest/` (or a pinned `/<version>/`) as a widget's install URL, with the github.io address beside it as the alternative. The repository keeps its name for now.

## Consequences

- The domain is what everything depends on: it renews automatically for several years, is locked at the registrar, and the registrar and Cloudflare accounts use two-factor authentication.
- The scheduled site check loads a released widget on both origins.
- A repository rename, if any, is decided before the first install URL is published.
