# 0024. 0.8.0 ships once the refactoring is done; M5 and M7 follow it

- **Status:** proposed
- **Date:** 2026-11-20
- **Amends:** [the plan to 0.8.0](../planning/2026-11-15-plan-0.8.md)
  ("Release 0.8.0 when M1–M7 are done")

## Context

The plan released 0.8.0 when its seven milestones were done. M1 to M4 and
M6 are. M5 (three real issues through the factory's skills, the scheduled
runs) and M7 (wave 3, awesome-grist-widgets absorbed, the six reference
repositories retired) are not, and each takes weeks of calendar time.

Meanwhile `main` holds 0.8's SDK and CLI: 14 of the pending changesets are
minors and the two packages' versions are fixed together, so any release
now is 0.8.0, and no patch release can go out before it. The maintainer
asked to finish the refactoring before publishing, to check that it holds
together. The refactoring is done:
- reference columns (ADR 0022);
- the API trimmed and covered;
- `examples/` retired (ADR 0023);
- the scaffold's leftovers;
- the site built in CI;
- a full project review, whose findings are fixed;
- a rehearsed release.

## Decision

- **0.8.0 is released as soon as the Version Packages pull request is
  green**, on the maintainer's go (ADR 0012), without waiting for M5 and
  M7.
- **M5 and M7 continue unchanged, towards 0.9.0.** They change the
  factory and the catalog more than the SDK; what they need from the SDK
  goes out on the weekly train as usual.
- **The template's CSP and standard criteria**, which the plan put in
  0.8.0, ship with M7, or earlier on the train. The catalog's widgets
  already meet them (ADR 0016, ADR 0018); scaffolded widgets don't yet.

## Consequences

- Widget authors get typed references, declared Ref columns that map,
  `httpUrl`, versioned options, read-only documents and the chrome's
  languages now, instead of in several weeks.
- The plan's "Release 0.8.0" section and `TODO.md` point here. 0.9.0 is the
  release that closes M5 and M7.
- A scaffold made from 0.8.0 has no CSP until the template gets one. A
  widget that needs one can copy a catalog widget's, as the template's
  `AGENTS.md` already suggests for patterns.
