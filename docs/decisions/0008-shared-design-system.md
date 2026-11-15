# 0008. One design system for every catalog widget

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Thirty to a hundred widgets must look like one product, meet a production bar on design, and be restyled without touching each one.

## Decision

- Catalog widgets use shadcn/ui from one shared copy, `widgets/_shared/ui/`, with the factory's only `components.json`.
- One theme of tokens, `widgets/_shared/theme.css`, maps to Grist's light and dark themes. Changing it restyles every widget at the next release.
- Widget code hard-codes no colour, pixel size or arbitrary Tailwind value; lint enforces it.
- Third-party views take their colours from the same tokens.
- Every widget ships in English and French from the first wave.

## Consequences

- A shadcn update is made once, for every widget.
- CI fails on a translation key missing from either language.
