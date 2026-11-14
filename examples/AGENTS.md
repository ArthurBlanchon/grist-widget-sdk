# Agent guide: the examples (`examples/`)

Sixteen example widgets, each `examples/<id>/` holding a widget's
`src/app/` (`WidgetApp.tsx`). The site builds them at
`/examples/<id>/latest/`, with a demo page in a real Grist at
`/examples/<id>/demo/`.

**This folder is on its way out.** The widget factory merges it into the
catalog ([ADR 0007](../docs/decisions/0007-widget-factory.md),
[`catalog/roadmap.md`](../catalog/roadmap.md)). Some examples become
catalog widgets; those that only show the API become test fixtures and
checked docs snippets. Don't add a new example: a new widget waits for
`widgets/` (factory step F1).

## Rules

- **An example uses the SDK as a widget does:** public entry points only,
  `defineGristWidget()`, and no `window.grist`.
- **A change to an example's columns, access or title regenerates its demo
  document.** Run the demo-documents command (Docker); CI's `check` fails
  otherwise.
- **The widget manifest is generated,** so `widgets.json` is never edited by
  hand.

## Commands

Run these from the repository root.

| Intent | Command |
| --- | --- |
| Type-check every example (builds the manifest first) | `node scripts/build-widgets-manifest.mjs && node scripts/typecheck-examples.mjs` |
| Regenerate the demo documents (Docker) | `node scripts/example-demos.mjs build` |
| Check the demo documents are current | `node scripts/example-demos.mjs check` |

## Path map

| Concept | Path |
| --- | --- |
| Shared UI for the examples | `_ui/` |
| Demo documents | `_demos/` |
| Vite configuration the site builds them with | `vite.config.ts` |
| How the site composes an example into a widget project | `../scripts/compose-example.mjs` |
