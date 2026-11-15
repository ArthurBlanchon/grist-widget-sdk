# 0014. The catalog's lists, and an id per major in Grist's

- **Status:** accepted
- **Date:** 2026-11-15
- **Extends:** [ADR 0013](./0013-widget-channels.md), to the gallery of a
  self-hosted Grist.

## Context

The plan to 0.8.0 (M2) asks for the catalog's lists to be generated from the
widgets' specs, and for Grist's gallery to list the catalog from the site.

A self-hosted Grist reads its gallery from `GRIST_WIDGET_LIST_URL`. A widget
added from that gallery keeps its `widgetId` in the document. Grist looks
the URL up by that id each time the document loads it, before the URL saved
with it (grist-core's `WidgetFrame`, `matchWidget`). The list therefore
decides which code a document runs, not only what the gallery offers.

- With one id per widget, a widget's next major would move that id to
  `/v<major+1>/`. It would reach every document that added the widget from
  the gallery: the break ADR 0013 rules out for a pasted URL.
- An id dropped from the list stops resolving. That happens when a widget
  is retired, or when a major is superseded.

## Decision

`scripts/widgets/catalog.mjs` makes every list from each widget's `SPEC.md`,
`package.json` and `CHANGELOG.md`. The site build writes two lists on each
origin, with that origin's install URLs:

| Path | What |
| --- | --- |
| `/widgets/catalog.json` | The listed widgets (beta and stable), for agents and tools: job, columns, access, network, install URLs, recent changes |
| `/widgets/grist-widgets.json` | Grist's format, for `GRIST_WIDGET_LIST_URL` |

In `grist-widgets.json`:
- **An id is a major channel:** `@grist-widgets/<slug>/v<major>`, at
  `/widgets/<slug>/v<major>/`. It never moves to another major.
- **Every released major of every widget stays listed,** retired widgets'
  included, so the documents that use them keep resolving.
- **Only the newest major of a beta or stable widget is `published`.** Grist
  shows only that one in its gallery, while the others still resolve.
- A retired widget keeps its folder (`status: retired`), so its ids stay
  listed.

The repository's root `widgets.json` stays what it is, the examples'
manifest that `create-grist-widget` embeds. `/widgets/catalog.json` is the
catalog's list. The examples gallery goes when M6 makes the catalog the
docs' examples.

## Consequences

- A widget's first major release adds an id, and the gallery offers only
  the new major. A document on the old major stays there until someone picks
  the widget again. `catalog.test.mjs` shows it.
- An id, once published, is kept for good. Renaming a widget's slug would
  orphan its ids, so a slug never changes.
- An unpublished entry carries the current title, description and access,
  not those of its major. Grist only uses them when a widget is added from
  the gallery, which unpublished entries are not.
