---
"create-grist-widget": minor
---

`create-grist-widget release <patch|minor|major>`, `pnpm release` in a widget: on `dev`, it bumps `package.json`'s version, writes the `CHANGELOG.md` entry from the pull requests `dev` has that `main` doesn't, and commits, then prints the push and the link to the `dev` → `main` pull request whose merge publishes ([Releasing a widget](https://gristwidgets.com/docs/cli/releasing)). It refuses off `dev`, with uncommitted changes, out of step with `origin/dev`, or with nothing to release. The template's Dependabot config now moves `grist-widget-sdk` and `create-grist-widget` in one pull request.

Existing widgets can run `pnpm exec create-grist-widget upgrade` after moving to this release: it adds the `release` script, the Dependabot group and the updated `AGENTS.md`.
