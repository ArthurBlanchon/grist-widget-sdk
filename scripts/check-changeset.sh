#!/usr/bin/env bash
# Fails if published-package source (the SDK, the CLI, or the template it
# embeds) changed against $BASE_REF without a .changeset/*.md file. Single
# source of truth for this check -- run from two places that must never
# drift apart:
#   - the `changeset` job of .github/workflows/ci.yml (the actual PR gate)
#   - .githooks/pre-push (a local, best-effort early warning -- CI is what
#     actually blocks a merge; this just means you find out before you
#     push instead of after, and a pre-push hook only fires if it's wired
#     up, see the `prepare` script in the root package.json)
#
# Usage: scripts/check-changeset.sh [base-ref]  (default: main)
set -euo pipefail

BASE_REF="${1:-main}"

git fetch origin "$BASE_REF" --quiet
# CHANGELOG.md is changesets' own output, not source -- excluded so a bare
# changelog-file addition/edit (e.g. seeding a missing one) never
# spuriously demands a changeset for itself.
changed="$(git diff --name-only "origin/${BASE_REF}...HEAD" | grep -v '/CHANGELOG\.md$' || true)"
echo "Changed files (vs origin/${BASE_REF}):"
echo "$changed"

if ! echo "$changed" | grep -qE '^(packages/core/src/|packages/create-grist-widget/(src|scripts)/|templates/grist-widget-template-vite/)'; then
  echo "No published-package source changed -- no changeset required."
  exit 0
fi

new_changesets="$(echo "$changed" | grep -E '^\.changeset/.+\.md$' | grep -v '^\.changeset/README\.md$' || true)"
if [ -z "$new_changesets" ]; then
  echo "::error::This change touches source that ships in a published package (packages/core, packages/create-grist-widget, or the template it embeds) but adds no .changeset/*.md file. Run 'pnpm changeset' and commit the result -- otherwise this change publishes nothing (or, if it rides along on an unrelated release, ships without its own changelog entry)."
  exit 1
fi

echo "Found changeset(s):"
echo "$new_changesets"
