# 0007. This repository is a widget factory

- **Status:** accepted
- **Date:** 2026-11-14

## Context

The project serves people who build with AI first. Its goal is a curated catalog of 30 to 100 production-grade widgets, built in series and kept current by agents, with the maintainer approving what ships. Six separate widget repositories already meant six pull requests for every update.

## Decision

- The catalog lives in this repository, in `widgets/<slug>/`, each with a `SPEC.md` that agents work from.
- `examples/` merges into the catalog.
- awesome-grist-widgets is absorbed, then archived.
- The template and `create-grist-widget` stay for widgets built elsewhere.
- The widgets are served by the existing two-origin site.
- The architecture stays simple and durable: no new service or secret without a measured need.
- The first list is [`catalog/roadmap.md`](../../catalog/roadmap.md).

## Consequences

- Plan and steps: [widget factory plan](../planning/2026-11-14-widget-factory-plan.md) (W1–W12).
- An SDK change and the migration of every widget go in the same pull request.
