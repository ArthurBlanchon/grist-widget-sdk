#!/usr/bin/env bash
# External-install smoke test.
#
# Simulates an external developer consuming the SDK from npm: pack the SDK into
# a tarball (what `npm publish` would ship), copy the Vite template OUTSIDE the
# workspace, rewrite its `grist-widget-sdk` dependency to that tarball, then
# `pnpm install && pnpm build`. Catches the class of bug where the template or
# SDK works only via workspace linking and breaks for real consumers.
#
# Run from the repo root:  bash scripts/smoke/external-install.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/templates/grist-widget-template-vite"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

echo "== 1/4 build + pack the SDK"
pnpm --filter grist-widget-sdk run build >/dev/null
# `pnpm pack` runs prepack (copies CHANGELOG + LICENSE into the package).
TARBALL="$(cd "$REPO_ROOT/packages/core" && pnpm pack --pack-destination "$WORK" | tail -1)"
# pnpm prints the path; normalize to an absolute path inside $WORK.
TARBALL="$WORK/$(basename "$TARBALL")"
test -f "$TARBALL" || { echo "::error::pack did not produce a tarball"; exit 1; }
echo "   packed: $(basename "$TARBALL")"

echo "== 2/4 copy the template outside the workspace"
PROJECT="$WORK/consumer"
mkdir -p "$PROJECT"
# Copy template sources only (no node_modules / dist / lockfile).
tar -C "$TEMPLATE_DIR" \
  --exclude node_modules --exclude dist --exclude .turbo \
  -cf - . | tar -C "$PROJECT" -xf -

echo "== 3/4 rewrite the SDK dependency to the packed tarball; drop monorepo-only script"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const tarball = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!pkg.dependencies || !pkg.dependencies["grist-widget-sdk"]) {
    console.error("template package.json has no grist-widget-sdk dependency");
    process.exit(1);
  }
  pkg.dependencies["grist-widget-sdk"] = "file:" + tarball;
  // prebuild builds the SDK via the workspace filter — meaningless for a consumer.
  if (pkg.scripts) delete pkg.scripts.prebuild;
  // The create-grist-widget devDependency (the deploy command) is a
  // workspace link too. This test is about the SDK; create-widget.sh checks
  // a real scaffold against the packed CLI, deploy command included.
  if (pkg.devDependencies) delete pkg.devDependencies["create-grist-widget"];
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$PROJECT/package.json" "$TARBALL"

echo "== 4/4 install + build as a standalone project"
# The consumer lives in a fresh mktemp dir (no parent workspace), and ships its
# own pnpm-workspace.yaml (build-script approvals for pnpm 11) — so DON'T pass
# --ignore-workspace here, or that file would be skipped and install would fail.
( cd "$PROJECT" && pnpm install )
( cd "$PROJECT" && pnpm run build )

echo "== OK: template installs and builds against the packed SDK tarball"
