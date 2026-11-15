# 0004. One version, one weekly train, published from main only

- **Status:** accepted
- **Date:** 2026-11-14

## Context

Two packages, `grist-widget-sdk` and `create-grist-widget`, must stay in step: a scaffold must get the SDK it was written for. Widgets install a version only once it is a day old, and agents with write access push branches to this repository.

## Decision

- **Fixed versions.** Changesets' `fixed` keeps both packages at the same version.
- **A weekly train.** The Version Packages pull request is merged once a week, or at once for a security fix.
- **Publish from `main` only.** npm Trusted Publishing (OIDC) runs in the `npm` environment, which accepts only `main`. There is no pre-release channel.
- **No bot token.** No `CHANGESET_PUSH_TOKEN`, and no commit onto Dependabot's branches: the train adds one routine changeset for the Dependabot updates it carries.

## Consequences

- Every user-visible change has a changeset, and CI enforces it (`scripts/check-changeset.sh`).
- The Version Packages pull request's CI runs are approved by hand.
- Procedure: [releasing](../operations/releasing.md) and the `release-train` skill.
