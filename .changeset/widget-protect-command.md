---
"create-grist-widget": minor
---

`create-grist-widget protect` applies, with the owner's `gh` CLI, the repository settings "Use this template" doesn't copy: the rulesets the template now ships in `.github/rulesets/` (`main`: a pull request and the `check` status, no force push or deletion; `dev`: no force push or deletion; `tags`: no tag moved or deleted), private vulnerability reporting, and GitHub Pages from `gh-pages` when it is off. It only adds what is missing, leaves a ruleset of the same name as it is, refuses before the widget's first release, and `--dry-run` shows what it would change.

The template's deploy workflow checks the rulesets on each release (`grist-widget-deploy check-protection`, with the workflow's read-only view of them; creating one takes an admin): a release without them warns in its summary, and the first release opens one issue, "Protect this repository", with the command. The check never fails a deploy.

Existing widgets can run `pnpm exec create-grist-widget upgrade` after moving to this release (it adds `.github/rulesets/`), then `pnpm exec create-grist-widget protect --dry-run` and `protect`. A widget whose `main` and `dev` already have rulesets under other names keeps them; delete those after `protect` creates its own, or skip it.
