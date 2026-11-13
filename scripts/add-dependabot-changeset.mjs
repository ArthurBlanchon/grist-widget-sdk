#!/usr/bin/env node
// Writes the changeset(s) that scripts/check-changeset.sh demands, for a
// Dependabot PR that can never run `pnpm changeset` itself. Only called by
// .github/workflows/dependabot-changeset.yml, and only once that workflow's
// own check-changeset.sh run has already confirmed one is missing.
//
// Maps changed published-package paths to the package name(s) that own them
// (see .changeset/config.json's `ignore` -- the template isn't versioned on
// its own, its changes are folded into create-grist-widget, which embeds it
// at build time; matches the precedent set by hand in
// .changeset/batch-p-template-favicon.md).
//
// Usage: node scripts/add-dependabot-changeset.mjs <base-ref> <pr-number>

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [baseRef, prNumber] = process.argv.slice(2);
if (!baseRef || !prNumber) {
  console.error("Usage: add-dependabot-changeset.mjs <base-ref> <pr-number>");
  process.exit(1);
}

const changed = execFileSync(
  "git",
  ["diff", "--name-only", `origin/${baseRef}...HEAD`],
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

// Order matters only for output determinism, not correctness -- each bucket
// gets its own changeset file so the changelog reads as one line per
// package, same as a human running `pnpm changeset` per concern would write.
const buckets = [
  {
    pkg: "grist-widget-sdk",
    slug: "sdk",
    test: (f) => f.startsWith("packages/core/"),
  },
  {
    pkg: "create-grist-widget",
    slug: "cli",
    test: (f) =>
      f.startsWith("packages/create-grist-widget/") ||
      f.startsWith("templates/grist-widget-template-vite/"),
  },
];

let written = 0;
for (const { pkg, slug, test } of buckets) {
  const files = changed.filter(test);
  if (files.length === 0) continue;

  const path = `.changeset/dependabot-pr-${prNumber}-${slug}.md`;
  const body = `---
"${pkg}": patch
---

Routine dependency updates via Dependabot (PR #${prNumber}). See the PR diff for the exact version bumps.
`;
  writeFileSync(path, body);
  console.log(`Wrote ${path} for ${pkg} (${files.length} file(s) changed)`);
  written += 1;
}

if (written === 0) {
  console.error(
    "check-changeset.sh said a changeset is needed, but no changed path matched a known package bucket -- add-dependabot-changeset.mjs needs updating.",
  );
  process.exit(1);
}
