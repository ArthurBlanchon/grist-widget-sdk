# 0010. API keys never go in widget options

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Grist stores a widget's options in the document, where every editor can read them. A key put there is shared with every editor.

## Decision

A widget that calls a service with a key (wave 3 of the catalog) keeps it in the person's own browser, never in widget options. It says plainly which data goes to which provider. There is no proxy: it would need a server and a secret.

## Consequences

- Each person enters their own key.
- A widget that needs no key (Mail merge as drafts or `mailto:`) stays without one.
