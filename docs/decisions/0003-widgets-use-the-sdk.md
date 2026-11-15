# 0003. Widgets read Grist only through the SDK, from one package

- **Status:** accepted
- **Date:** before 2026-11; recorded 2026-11-14

## Context

Widgets that call the `grist` global fight over subscriptions, are hard to test and break when Grist's RPC changes.

## Decision

Widget code never touches `window.grist`; it calls `useGrist()` (or `widget.useGrist()`). Everything ships from one npm package, `grist-widget-sdk`, with a few entry points (`/app`, `/actions`, `/emulator`, `/emulator/testing`, the TypeScript configurations). Code imports public entry points only, never `grist-widget-sdk/src/…`.

## Consequences

- The SDK calls `grist.ready` once and owns every subscription.
- No `@grist/*` split into several packages.
- The design rules in [architecture](../architecture.md#design-rules) follow from this.
