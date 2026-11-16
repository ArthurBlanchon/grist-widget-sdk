# Upkeep on a schedule

> Read this when a scheduled run starts, or to see what the catalog's
> upkeep is and when it is due (plan 0.8, M5 item 16).

The catalog stays current through four rhythms, each run by a skill in
`.claude/skills/`. A run that finds nothing to do still writes its line in
[the upkeep log](./upkeep-log.md), in a docs pull request of its own (an
agent's merge), so a missed run shows. Every run reads
[untrusted input](./untrusted-input.md) first.

| When | What | Skill | Merged by |
| --- | --- | --- | --- |
| Weekly, when Dependabot's `routine` pull request opens | The week's patch and minor updates, the whole catalog checked in a real Grist and compared with its last releases | `catalog-upgrade` | The maintainer's go: the catalog's versions live in `pnpm-workspace.yaml`, with CI's tools ([ADR 0012](../decisions/0012-merge-authority.md)); the agent prepares the evidence |
| Monthly, the first Monday | The widgets whose build changed since their release, released together | `release-widgets` | The agent for patches and minors; a major needs the maintainer's go |
| As soon as the fixed version is 7 days old | A security fix in a widget's dependency, updated and released ([ADR 0006](../decisions/0006-dependency-age.md): sooner is the maintainer's decision alone, never an exclude entry) | `catalog-upgrade`, then `release-widgets` | The maintainer's go ([ADR 0012](../decisions/0012-merge-authority.md)) |
| Monthly, the third Monday, a category in turn | A catalog category against the state of the art, findings opened as issues | `sota-review` | Nothing to merge: issues only ([ADR 0020](../decisions/0020-agents-on-issues.md)) |

The categories rotate in three slots, so each comes round once a quarter:
visualisation; data-entry; documents, planning and maps together.

## Rules

- **Dependabot's own pull requests are the input.** The weekly run takes
  the open `routine` one; it doesn't open its own.
- **The age check holds** ([ADR 0006](../decisions/0006-dependency-age.md)):
  a version installs once it is 7 days old; a younger one waits for the
  next week.
- **Nothing commits onto Dependabot's branches** ([releasing](./releasing.md)).
- **New issues are triaged as they come** (`triage-issue`), not on a
  schedule: an issue left with the `triage` label for a week is a missed
  run (one waiting for the maintainer carries `proposed` instead).
- **After each milestone, a retro:** what slowed the work down (a missing
  check, a flaky job, a rule nobody could follow), each as an item in
  `TODO.md`.
