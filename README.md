# grist-widget-sdk

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/ArthurBlanchon/grist-widget-sdk/badge)](https://scorecard.dev/viewer/?uri=github.com/ArthurBlanchon/grist-widget-sdk)

Monorepo (`grist-widget-sdk-monorepo`) for building Grist widgets with React and TypeScript.

Documentation: **[gristwidgets.com](https://gristwidgets.com)** (source in `apps/www/content/docs/`).

## What is inside

- `packages/core` - `grist-widget-sdk`, the reusable SDK package
- `examples` - the SDK's example widgets (each `examples/<id>/` is a widget's `src/app/`); the site serves each one in a real Grist at `/examples/<id>/demo/`
- `apps/www` - landing site + documentation (Next.js + fumadocs + shadcn/ui, static export), deployed at the site root
- `templates/grist-widget-template-vite` - standalone starter template

## Quick start

Requirements:

- Node.js 22.22.2+ or 24.15+ (jsdom 31, used by the test suites, requires it)
- pnpm 11+ (provisioned automatically via Corepack)

Install and run from repository root:

```bash
corepack enable
pnpm install
pnpm dev
```

## Common commands

From root:

```bash
pnpm dev          # turbo: the SDK in watch mode (docs excluded)
pnpm build
pnpm test
pnpm dev:docs
pnpm build:docs
pnpm build:www
```

Target specific workspaces:

```bash
pnpm --filter grist-widget-sdk dev
pnpm --filter grist-widget-sdk build
```

## How to use this monorepo

- Make shared/runtime behavior changes in `packages/core`.
- Validate consumer behavior with the emulator tests (`pnpm --filter grist-widget-sdk test`) and in a real Grist (`pnpm e2e:grist <widget dir>`, or a widget's `pnpm demo`).
- Keep documentation aligned in `apps/www/content/docs/`.
- Build out the site in `apps/www` (GitHub Pages only; deliberately has no `grist-widget-sdk` dependency).
- Use the template in `templates/grist-widget-template-vite` for external scaffolding scenarios.
- For deploy details (GitHub Pages, Cloudflare Pages), see [site deploy](./docs/operations/site-deploy.md).

## Working in this repo

Pick work from [`TODO.md`](./TODO.md), the one ordered list of work left; align scope in chat; ship code, docs, tests and a changeset together. Details: [`AGENTS.md`](./AGENTS.md).

## AI-agent friendly docs

Start at [`AGENTS.md`](./AGENTS.md) — operating contract, commands, path map,
decision tree, anti-patterns, hand-off checklist.

The docs site also publishes machine-readable formats:
[`/llms.txt`](https://gristwidgets.com/llms.txt) (index),
[`/llms-full.txt`](https://gristwidgets.com/llms-full.txt) (full corpus), and
per-page markdown at `/llms.mdx/docs/<path>/content.md`.

## Notes

- Workspaces are managed with `pnpm-workspace.yaml`.
- Task orchestration is handled by `turbo.json`.
- `packages/core` is a library package built with `tsup`.
