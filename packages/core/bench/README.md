# Render budget benchmarks

Reproducible React render counts for common SDK operations.

## Run

```bash
pnpm --filter grist-widget-sdk bench
```

This runs `packages/core/tests/bench/render-budget.test.tsx` and checks each
scenario against `results.json`, the committed baseline: a scenario that
renders more than its baseline fails. CI runs it in `ci.yml`'s `core` job.

```bash
pnpm --filter grist-widget-sdk bench:update
```

rewrites the baseline. Run it, and commit `results.json`, when a render change
is intended (or after an improvement, which the check reports).

## Scenarios

| Key | Hook | Trigger |
|-----|------|---------|
| `fullRecordSubscription` | `useGrist()` | `emulator.selectRow` |
| `write` | `useGrist()` | `table.create` |
| `schemaFetch` | `useGristSchema()` | `reload()` |

Counts are **delta renders** on the probe component between setup and the operation (jsdom + Vitest).
