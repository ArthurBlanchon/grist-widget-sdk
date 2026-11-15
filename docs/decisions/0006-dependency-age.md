# 0006. A minimum age for every dependency

- **Status:** accepted
- **Date:** before 2026-11; recorded 2026-11-14

## Context

A compromised package version is usually caught and removed within days. Installing versions the moment they are published is how supply-chain attacks spread.

## Decision

- pnpm's `minimumReleaseAge` is 7 days in this repository and pnpm's default 24 hours in widgets.
- Nobody adds a `minimumReleaseAgeExclude` entry to get an install or a check green. The only entries are the ones pnpm writes for `grist-widget-sdk` and `create-grist-widget` on release day; `upgrade` removes them once they are old enough.
- GitHub Actions are pinned by commit SHA, at versions at least 7 days old.
- CI runs zizmor, dependency-review and Scorecard.

## Consequences

- A fix in a dependency reaches this repository a week after its release, and widgets a day after.
- Work that needs a new version waits for it to age.
