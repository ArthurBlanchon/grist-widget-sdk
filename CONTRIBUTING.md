# Contributing

## Workflow

Plan in conversation; track work on the repo:

- [`TODO.md`](./TODO.md) — the one ordered list of work left
- `docs/planning/` — the review or plan `TODO.md` comes from
- `docs/history/` — finished plans and the old backlog
- `pnpm changeset` — shipped history; generates `packages/core/CHANGELOG.md`
  and `packages/create-grist-widget/CHANGELOG.md` on release

Details: [`AGENTS.md`](./AGENTS.md) — Cursor and every other supported agent
read it natively; there is no separate vendor-specific rule file.

## CI

`.github/workflows/ci.yml` runs every check a pull request into `main`
needs. Its `changes` job picks the jobs a diff needs
(`scripts/ci/changes.mjs`: one rule per job), and its `gate` job, the only
required check, passes when those passed. A docs-only pull request runs
almost nothing and still merges without a bypass. A new check is a job in
`ci.yml`, a rule in `changes.mjs` and an entry in `gate`'s `needs`.

## Extracting a widget from the monorepo to its own repo

1. Create the target repo (GitHub "Use this template", "Include all
   branches") — this immediately auto-fires the deploy workflow on `main`
   (GitHub itself pushes the copied content to the new ref), which publishes
   a clean `v0.0.1` + `/latest/` + root right away: a repo's first genuine
   release always resolves to `v0.0.1` regardless of the inherited
   `package.json` version. That same first release also rewrites
   `package.json`'s version back to `0.0.1` in the repo (a commit pushed to
   `main`/`dev`), so the *next* release bumps cleanly to `0.0.2`.
2. Clone, `git pull` on `dev` (to pick up the version-reset commit), then
   copy the widget's unique files over the scaffold's boilerplate; update
   `package.json`'s `name` + `grist` metadata block + any extra deps,
   `index.html`'s `<title>`, and `README.md`.
3. **Bump `package.json`'s `version` to `0.0.2`** as part of this same
   change — the copy already published `v0.0.1` (the bare template) on
   creation, so your first release *with real content* needs a new version
   to publish. Push to `dev`, open a PR into `main`, merge.
4. Verify `/latest/` and `/v0.0.2/` both reflect the migrated widget's
   content before considering the migration done.

## Language

English for docs, comments, commits, and PR text unless a file explicitly requires otherwise.

## Conduct and security

Everyone taking part follows the [code of conduct](./CODE_OF_CONDUCT.md).
Report a vulnerability privately, as [SECURITY.md](./SECURITY.md) explains,
never in a public issue.
