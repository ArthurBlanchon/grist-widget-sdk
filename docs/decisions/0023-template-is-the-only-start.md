# 0023. The template is the only starting point; examples/ is retired

- **Status:** accepted (the maintainer, 2026-11-17)
- **Date:** 2026-11-19

## Context

`examples/` held 16 example widgets. The CLI embedded them (`list`, `use`,
`create --example`), the site built each one with a demo page, and the docs
included their code. The catalog (`widgets/`) now holds 16 widgets with a
spec, a test per criterion, a run in a real Grist and released versions.
The examples drifted from the current API more than once, and an example
copied by `--example` couldn't be upgraded like the template. The widgets
are mostly built by AI agents, which need one predictable starting point,
and patterns to read rather than copies to prune.

## Decision

- **Every widget starts from the template.** `create-grist-widget list`,
  `use` and `create --example` are retired: they exit with a pointer to the
  catalog.
- **The catalog is where patterns are read.** The template's `AGENTS.md`
  names catalog widgets for common patterns; an agent reads one's spec,
  code and tests and adapts it, never depending on `widgets/_shared/`.
- **No CLI path copies a catalog widget.** It would need `widgets/_shared/`
  embedded and rewritten, the drift `examples/` had.
- **What examples proved, docs snippets prove now.** Every public runtime
  name of the SDK is used by a catalog widget or by a compiled docs snippet
  (`scripts/ci/api-coverage.mjs`, in CI).
- **Their URLs redirect.** `/examples/<id>/latest/`, `/examples/<id>/demo/`
  and the Examples page send readers to `/widgets/`.

## Consequences

- The CLI package is smaller (no examples, ui sources, compose engine or
  manifest), and its smoke test checks the retired commands' pointer.
- A Grist document that still embeds an example's URL shows the redirect
  page, not the widget: the examples were never listed as installable.
- `widgets.json` (the examples' manifest) and its scripts are gone; the
  registry's own `widgets.json` (awesome-grist-widgets) is unchanged.
