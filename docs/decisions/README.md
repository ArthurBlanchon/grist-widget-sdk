# Decisions

One decision per file: its context, the decision and its consequences. A
record is never edited after it is accepted, apart from its status. A
decision that changes gets a new record, and the old one's status becomes
"superseded by NNNN".

To add one, copy the shape of the latest file, take the next number, and
link it from where the decision is applied.

| # | Decision |
| --- | --- |
| [0001](./0001-two-site-origins.md) | Two independent origins for the site |
| [0002](./0002-real-grist-only.md) | Widgets render only in a real Grist |
| [0003](./0003-widgets-use-the-sdk.md) | Widgets read Grist only through the SDK, from one package |
| [0004](./0004-release-train.md) | One version, one weekly train, published from main only |
| [0005](./0005-one-declaration.md) | One declaration, and a provider always |
| [0006](./0006-dependency-age.md) | A minimum age for every dependency |
| [0007](./0007-widget-factory.md) | This repository is a widget factory |
| [0008](./0008-shared-design-system.md) | One design system for every catalog widget |
| [0009](./0009-install-urls.md) | Install URLs on gristwidgets.com |
| [0010](./0010-api-keys.md) | API keys never go in widget options |
| [0011](./0011-reference-widgets-retired.md) | The six reference widgets are retired, not released again |
| [0012](./0012-merge-authority.md) | Who merges what |
| [0013](./0013-widget-channels.md) | A catalog widget's channels: one per major, and dev |
| [0014](./0014-catalog-lists.md) | The catalog's lists, and an id per major in Grist's |
| [0015](./0015-widget-licences.md) | The licences a catalog widget may ship |
| [0016](./0016-widget-csp.md) | A Content Security Policy in every catalog widget's page |
| [0017](./0017-widget-options-version.md) | Widget options carry the version that wrote them |
| [0018](./0018-standard-criteria.md) | Every catalog widget meets four standard criteria |
| [0019](./0019-report-a-problem.md) | "Report a problem" is a link the person opens, never telemetry |
| [0020](./0020-agents-on-issues.md) | What agents do to issues on their own |

The plans in [`docs/planning/`](../planning/) and
[`docs/history/`](../history/) hold the reasoning in full. The design
rules of the SDK are in [architecture](../architecture.md#design-rules).
The SDK's former "open questions" page is kept as
[`docs/history/2026-11-14-sdk-open-questions.md`](../history/2026-11-14-sdk-open-questions.md):
most of it was settled by 0.5–0.7.
