# 0002. Widgets render only in a real Grist

- **Status:** accepted
- **Date:** before 2026-11; recorded 2026-11-14

## Context

A local preview fed by an emulator looks like the widget working, and differs from Grist in ways nobody notices until a user does.

## Decision

Outside Grist, `pnpm dev` shows the SDK's local-dev page, not the widget. Real Grist comes three ways:
- the demo page: grist-static, Grist running in the browser from static files;
- `pnpm demo`, a pinned Grist in Docker;
- a live document on the `dev` channel.

`pnpm test` with the emulator is the fast headless loop.

## Consequences

- Nobody builds or suggests a seeded `pnpm dev` preview; it is listed as an anti-pattern in the template's `AGENTS.md`.
- The emulator is checked against a real Grist by the real-widgets job, and fixed when they differ.
