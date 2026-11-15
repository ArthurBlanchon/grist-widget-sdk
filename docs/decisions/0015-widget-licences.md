# 0015. The licences a catalog widget may ship

- **Status:** accepted
- **Date:** 2026-11-15

## Context

A catalog widget's build is copied for good: into `widgets-dist`, onto two
origins, into the documents that load it and the forks that copy it. Its
source is not alongside. The plan to 0.8.0 (§3) asked for licences
"checked against the allow list (MIT, BSD, Apache-2.0, ISC)".

The first check, on the widgets' `--prod` dependencies, listed build tools
(lightningcss under MPL-2.0, caniuse-lite under CC-BY-4.0) whose code no
widget ships, and missed what Tailwind inlines from CSS. The check on what
the bundle holds found Mermaid diagram 0.1.0 shipping elkjs (EPL-2.0 or
GPL-3.0), through Mermaid 12's default ELK layout.

## Decision

- **What counts is what the build ships:** the modules the output chunks
  render, the assets' source files, and the packages the widget's CSS
  `@import`s. `widgets/_shared/vite.ts` writes them to `dist/licenses.json`.
- **The allow list:** MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0,
  0BSD, Unlicense, CC0-1.0, BlueOak-1.0.0, and OFL-1.1 for fonts. These are
  permissive, or public-domain-like, and need only their notice kept.
- **No copyleft, weak or strong** (MPL, EPL, LGPL, GPL), unless it is one
  side of an OR whose other side is allowed. A widget copied without its
  source can't keep copyleft's source obligations.
- An SPDX expression is parsed with its precedence: an OR needs one allowed
  side, an AND every one. What doesn't parse is refused.
- **Notices travel with the widget:** the build also writes
  `dist/THIRD-PARTY-NOTICES.txt`, each package's licence and NOTICE files.
- `check-widgets --sizes` refuses a widget that ships anything else. A
  dependency the list refuses is replaced, stubbed (as elkjs is), or left
  out.

## Consequences

- Adding a licence to the list is a change to this record.
- Mermaid diagram 0.2.0 lays every diagram out with Dagre, and elkjs is
  stubbed for every widget (`_shared/lib/no-elk.ts`).
- Mermaid diagram 0.1.0 stays published with elkjs and no notice: a
  released version is never rebuilt (ADR 0013). Whether to withdraw it or
  add a notice next to it is the maintainer's call (TODO.md §0).
- Workspace packages (grist-widget-sdk, `_shared`, MIT, this repository's)
  aren't listed, nor code a package vendors in its own files: that is the
  package's to declare.
