# Contributing

Development here is done with AI agents. Start with [`AGENTS.md`](./AGENTS.md):
it is the entry point, for agents and people alike, and points to the
architecture, the decisions, the procedures and the skills. Cursor and the
other agents that support `AGENTS.md` read it natively.

## Workflow

- Plan in conversation with the maintainer.
- Track the work in [`TODO.md`](./TODO.md): the one ordered list of work
  left. The plan it comes from is in [`docs/planning/`](./docs/planning/),
  and finished plans are in [`docs/history/`](./docs/history/).
- Record a lasting choice in [`docs/decisions/`](./docs/decisions/).
- Ship history through `pnpm changeset`, which generates the packages'
  `CHANGELOG.md` files on release.

## CI

`.github/workflows/ci.yml` runs every check a pull request into `main`
needs:
- its `changes` job picks the jobs a diff needs (`scripts/ci/changes.mjs`,
  one rule per job);
- its `gate` job, the only required check, passes when those passed.

A docs-only pull request runs almost nothing and still merges without a
bypass. A new check is three changes: a job in `ci.yml`, a rule in
`changes.mjs`, and an entry in `gate`'s `needs`.

## Language

English for docs, comments, commits and pull request text, unless a file
explicitly requires otherwise.

## Conduct and security

Everyone taking part follows the [code of conduct](./CODE_OF_CONDUCT.md).
Report a vulnerability privately, as [SECURITY.md](./SECURITY.md) explains,
never in a public issue.
