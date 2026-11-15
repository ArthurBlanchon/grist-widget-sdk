# 0005. One declaration, and a provider always

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Up to 0.6, a widget could configure its connection in three places: `GRIST_OPTIONS`, `useGrist(options)` and `useGristSchema()`'s options. Outside a provider, `useGrist()` opened a page-wide connection. "Which options won" became a puzzle, and the page connection only served tests that forgot `widget`. The maintainer is the SDK's only user before 1.0.

## Decision

- A widget declares its access, columns and metadata once, with `defineGristWidget()`. `mountGristWidget()` always renders the provider.
- **0.7 removes** the page-wide connection, `useGrist(options)`, `useGristSchema()`'s connection options, and every name 0.6 deprecated. `useGrist()` throws outside a provider; `useGristOptional()` returns `null` there. This replaces the plan to 1.0's D1 and D4, which kept them deprecated until 1.0.
- **Before 1.0,** a minor can break a widget. Its changelog says what changed, and `upgrade` rewrites what it can and lists the rest. **From 1.0,** a name is deprecated for at least one minor before it goes ([versioning policy](https://gristwidgets.com/docs/sdk/api/versioning)).

## Consequences

- The docs describe the current API only, with no deprecated forms.
- `upgrade`'s codemods keep migrating older widgets.
