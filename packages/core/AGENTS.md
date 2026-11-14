# Agent guide: `grist-widget-sdk` (`packages/core`)

The SDK, the app chrome (`grist-widget-sdk/app`), the user-action builders
(`/actions`) and the emulator (`/emulator`, `/emulator/testing`). Read
[`docs/architecture.md`](../../docs/architecture.md) first: its design
rules decide whether a change to the public surface is accepted.

## Rules

- **The public surface is the entry points.** They are `src/sdk/index.ts`,
  `src/app/index.ts`, `src/actions/index.ts`, `src/emulator/index.ts` and
  `src/emulator/testing/index.ts`; nothing else is public. A change to a
  public name or type is reviewed through the API report.
- **A change to the public API comes with:**
  - the API report regenerated: `build`, then `api:report`, and the
    `api/` files committed;
  - the list in `tests/sdk/public-api.test.ts`;
  - its docs page under `apps/www/content/docs/`;
  - a changeset.
- **Every `useGrist()` member has a contract test** in
  `tests/contract/use-grist.contract.test.tsx`. The first test there fails
  when a member exists without its block.
- **The emulator follows Grist.** A behaviour change in the runtime is
  mirrored in the emulator, never papered over with a test-only shim.
  Writes go through `mapBack`, in both.
- **React 18 and 19.** CI runs the tests on both (`core-react18`).
- **The size budget** (`size` job) and the render budget (`bench`) hold.
  Check `bench` before raising the bench baseline.
- **No new runtime dependency** without a decision record: a widget's
  runtime path stays small.

## Commands

| Intent | Command |
| --- | --- |
| Build | `pnpm --filter grist-widget-sdk build` |
| Test (unit, emulator, contract, docs snippets) | `pnpm --filter grist-widget-sdk test` |
| Type-check | `pnpm --filter grist-widget-sdk typecheck` |
| Lint | `pnpm --filter grist-widget-sdk lint` |
| Regenerate the API report (after `build`) | `pnpm --filter grist-widget-sdk api:report` |
| Render budget | `pnpm --filter grist-widget-sdk bench` |

## Path map

| Concept | Path |
| --- | --- |
| Root entry | `src/sdk/index.ts` |
| useGrist() and its result | `src/sdk/use-grist.ts` |
| The declaration | `src/sdk/define-widget.ts` |
| Runtime (store, ready, reads and writes) | `src/sdk/runtime/` |
| Provider and boundary | `src/sdk/components/` |
| App mount and chrome | `src/app/` |
| User-action builders | `src/actions/index.ts` |
| Emulator | `src/emulator/` |
| Test helpers (renderWithGrist, smokeTestWidget) | `src/emulator/testing/` |
| Contract tests | `tests/contract/` |
| Public names | `tests/sdk/public-api.test.ts` |
| API reports | `api/` |
| Changelog (generated) | `CHANGELOG.md` |
