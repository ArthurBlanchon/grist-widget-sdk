---
name: fix-issue
description: Fix a reproduced issue of grist-widget-sdk end to end - a failing test first, the fix, the spec and changelog, a pull request that opens with the problem, its independent review where needed, and the merge only within ADR 0012. Use when asked to fix an issue, or to take one labelled `reproduced`.
---

# Fix an issue

**Merge authority:** [ADR 0012](../../../docs/decisions/0012-merge-authority.md)'s
table, the stricter row winning. A catalog widget's patch or minor, a
test, a docs page: the agent merges on green. Anything in `packages/`,
`scripts/`, `.github/`, an `AGENTS.md` or a decision: the maintainer's go,
after an [independent review](../../../docs/operations/independent-review.md).
**Calls:** `triage-issue` first if the issue isn't `reproduced`;
`write-docs-page` for a docs change.

## The proof standard

Evidence observed in this session: the reproduction fails, the fix goes
in, the same reproduction passes. A test that only mocks the failing part
isn't proof of a widget's runtime behaviour: the real-Grist check is
(`pnpm e2e:grist widgets/<slug> --build --standard`), and the pull
request's comparison with the last release shows what it changed on
screen.

## Steps

1. **Branch** from `main`, named for the issue.
2. **A failing test first**, named for the criterion it checks:
   `it("AC-n …")`, from `triage-issue`'s reproduction. Run it and see it
   fail for the issue's reason, not another.
3. **The fix**, the smallest that makes it pass. No refactor riding along:
   one issue, one pull request.
4. **The spec stays true.** A behaviour change changes `SPEC.md` (the
   criterion, written as `triage-issue` proposed it) in the same commit.
5. **Release it** when it is a catalog widget: the version raised (a fix is
   a patch; see `widgets/AGENTS.md`, Releasing) and its `CHANGELOG.md`
   entry, in the person's words. For the SDK or the CLI: `pnpm changeset`.
6. **Run the checks for what changed:** the widget's `test`, `typecheck`,
   `lint` and `build`, `node scripts/widgets/check-widgets.mjs <slug>`, and
   the real-Grist check; the SDK's own suite for `packages/core`. CI runs
   the rest.
7. **The pull request opens with the problem**, not a list of changes:
   what the person saw, why, what changes, and the proof (the test red then
   green, the e2e lines). "Fixes #n" in the body.
8. **Watch it, don't poll it:** subscribe to the pull request's activity
   and end the turn. Fix a red check by reproducing it first; answer every
   bot or review finding with a fix or one line on why it doesn't apply.
9. **Merge** when the table allows it, the gate is green, every finding is
   answered and the branch is current. Read the comparison with the last
   release first (`widgets/AGENTS.md`) and say in the pull request whether
   a change on screen is intended. Never `--admin`, never past a red check.
10. **After the merge:** the issue closes with the pull request; for a
    widget, check the release is served (`/widgets/<slug>/<version>/`) and
    say so on the issue.
