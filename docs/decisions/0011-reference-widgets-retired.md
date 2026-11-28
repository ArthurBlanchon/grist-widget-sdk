# 0011. The six reference widgets are retired, not released again

- **Status:** accepted; amended by [ADR 0026](./0026-one-maintenance-model.md)
  (2026-11-28): the six stay, as the external widgets of record, and the
  real-widgets job keeps checking them
- **Date:** 2026-11-15

## Context

Six widgets live in repositories of their own: gantt-widget,
news-feed-widget, ask-ai-widget, world-map, create-email-draft and
scan-with-ai. They were the SDK's reference widgets: its real-widgets job
checks each SDK change against their `dev`. The catalog now rebuilds their
jobs in this repository ([ADR 0007](./0007-widget-factory.md)). Gantt chart,
Map and Mail merge are built. Ask AI and Scan with AI are in wave 3. The
news feed has no catalog entry yet.

## Decision

- The six get no new release. One exception is a security fix in
  production: world-map 0.2.1, past the MapLibre 5 XSS.
- Their `dev` keeps building on each SDK release, as long as the
  real-widgets job checks them.
- At the very end of the factory's migration, the six are deleted. Before
  that, the real-widgets job moves its references to the catalog widgets,
  and the registry stops listing the six.

## Consequences

- TODO step A (their 0.3.0 release) and step E (their releases on 0.7)
  go: their `dev` builds against 0.7 already. 1.0 is taken by the catalog
  widgets, in the pull request that makes it.
- Before the six are deleted, the news feed is either added to the
  catalog or dropped: the maintainer decides.
