#!/usr/bin/env bash
# Template deploy-workflow smoke test.
#
# Exercises grist-widget-deploy — create-grist-widget's single-widget deploy
# publisher (packages/create-grist-widget/src/deploy.mjs), which every
# scaffolded repo's deploy.yml runs through its devDependency on the CLI —
# called through the template's own node_modules/.bin link, as the workflow
# does,
# against a local bare git repo standing in for gh-pages. No GitHub API or
# network involved: pure local git + fs, so it needs no secrets/tokens.
#
# Checks: release places v<version>/ + latest/ + root, a second plan for the
# same version is skipped (idempotence), the dev channel places dev/ with
# version.json + the injected self-reload snippet, a concurrent push is
# recovered via finalize's rebase-and-retry, a repo's first genuine release
# clears inherited foreign content (v<version>/ dirs, root, latest) and
# resolves to v0.0.1 regardless of package.json, the first-release reset
# rewrites package.json's version to 0.0.1 + personalizes the four
# placeholder-identity spots (package.json, README.md, index.html, App.tsx)
# to the real repo name + prunes stray branches + resets dev to main, and
# `remove` retires dev/ without touching a release or latest/.
#
# Run from the repo root:  bash scripts/smoke/template-deploy.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/templates/grist-widget-template-vite"
DEPLOY_BIN="$TEMPLATE_DIR/node_modules/.bin/grist-widget-deploy"
test -x "$DEPLOY_BIN" || { echo "::error::$DEPLOY_BIN missing: the template must depend on create-grist-widget (run pnpm install)"; exit 1; }
REPO_NAME="dry-run-repo"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

VERSION="$(node -p "require('$TEMPLATE_DIR/package.json').version")"

# The `plan` subcommand reads package.json relative to cwd — correct for the
# real workflow (cwd is the scaffolded repo root, where package.json lives).
# Run it from TEMPLATE_DIR accordingly,
# without changing this script's own cwd (pnpm --filter ... exec, used below
# to build the template, must run from the monorepo root — invoking it from
# inside the filtered package's own directory confuses pnpm's workspace
# resolution).
deploy() { ( cd "$TEMPLATE_DIR" && "$DEPLOY_BIN" "$@" ); }

# The template's grist-widget-sdk dependency is workspace-linked (resolves to
# packages/core/dist) while inside this monorepo — build it first, or a
# fresh checkout with no dist/ yet fails type-checking with "Cannot find
# module 'grist-widget-sdk'". Same first step external-install.sh and
# create-widget.sh already take.
echo "== 0/11 build the SDK (workspace-linked dependency of the template)"
pnpm --filter grist-widget-sdk run build
# The deploy workflow's build job also runs `create-grist-widget manifest`;
# its bin imports files the package's build generates (vendor/, as in the
# published tarball), so build it too.
node scripts/build-widgets-manifest.mjs >/dev/null
pnpm --filter create-grist-widget run build

echo "== 1/11 bootstrap a bare repo standing in for gh-pages"
git init --bare -q "$WORK/bare.git"
git clone -q "$WORK/bare.git" "$WORK/bootstrap"
git -C "$WORK/bootstrap" checkout --orphan gh-pages -q
git -C "$WORK/bootstrap" rm -rf . >/dev/null 2>&1 || true
touch "$WORK/bootstrap/.nojekyll"
git -C "$WORK/bootstrap" add -A
git -C "$WORK/bootstrap" -c user.name=test -c user.email=test@test.com commit -q -m "init gh-pages"
git -C "$WORK/bootstrap" push -q origin gh-pages

echo "== 2/11 release: build + plan + place + finalize"
RUN1="$WORK/run1"
mkdir -p "$RUN1"
git clone -q --branch gh-pages "$WORK/bare.git" "$RUN1/site"
git -C "$RUN1/site" config user.name "github-actions[bot]"
git -C "$RUN1/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

RELEASE_BASE="/$REPO_NAME/v$VERSION/"
PLAN1="$(deploy plan --site "$RUN1/site" --repo "$REPO_NAME" --event push --ref refs/heads/main)"
echo "   plan: $PLAN1"
node -e '
  const p = JSON.parse(process.argv[1]);
  if (p.context !== "release" || p.skip !== false) { console.error("expected a fresh release plan"); process.exit(1); }
' "$PLAN1"

pnpm --filter grist-widget-template-vite exec tsc -b
pnpm --filter grist-widget-template-vite exec vite build --base "$RELEASE_BASE"
pnpm --filter grist-widget-template-vite exec create-grist-widget manifest --base "$RELEASE_BASE" --owner-repo "owner/$REPO_NAME" >/dev/null
deploy place --site "$RUN1/site" --repo "$REPO_NAME" --channel release --version "$VERSION" \
  --dist "$TEMPLATE_DIR/dist" --sha rel1234 --ref refs/heads/main
deploy finalize --site "$RUN1/site" --repo "$REPO_NAME" --update-versions --push --commit-message "deploy: release @ rel1234"

test -f "$RUN1/site/v$VERSION/index.html" || { echo "::error::v$VERSION/index.html missing"; exit 1; }
test -f "$RUN1/site/latest/index.html" || { echo "::error::latest/index.html missing"; exit 1; }
test -f "$RUN1/site/index.html" || { echo "::error::site root index.html (hub) missing"; exit 1; }
test -f "$RUN1/site/versions.json" || { echo "::error::versions.json missing"; exit 1; }
for d in "v$VERSION" latest; do
  node -e '
    const m = require(process.argv[1]);
    if (m.url !== process.argv[2] || m.published !== true || m.gristWidgetSdk?.channel !== "release" || !m.widgetId) {
      console.error("bad manifest", JSON.stringify(m)); process.exit(1)
    }' "$RUN1/site/$d/grist-widget.json" "https://owner.github.io$RELEASE_BASE" \
    || { echo "::error::$d/grist-widget.json missing or wrong"; exit 1; }
done
grep -q "\"$VERSION\"" "$RUN1/site/versions.json" || { echo "::error::versions.json missing $VERSION"; exit 1; }

echo "== 3/11 idempotence: re-plan the same version must skip"
RUN2="$WORK/run2"
git clone -q --branch gh-pages "$WORK/bare.git" "$RUN2/site"
git -C "$RUN2/site" config user.name "github-actions[bot]"
git -C "$RUN2/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
PLAN2="$(deploy plan --site "$RUN2/site" --repo "$REPO_NAME" --event push --ref refs/heads/main)"
echo "   plan: $PLAN2"
node -e '
  const p = JSON.parse(process.argv[1]);
  if (p.skip !== true || p.reason !== "already-published") { console.error("expected skip=true, already-published"); process.exit(1); }
' "$PLAN2"

echo "== 4/11 dev channel: build + place + finalize"
DEV_BASE="/$REPO_NAME/dev/"
PLAND="$(deploy plan --site "$RUN2/site" --repo "$REPO_NAME" --event push --ref refs/heads/dev)"
echo "   plan: $PLAND"
node -e '
  const p = JSON.parse(process.argv[1]);
  if (p.context !== "dev") { console.error("expected dev context"); process.exit(1); }
' "$PLAND"

pnpm --filter grist-widget-template-vite exec vite build --base "$DEV_BASE"
pnpm --filter grist-widget-template-vite exec create-grist-widget manifest --base "$DEV_BASE" --owner-repo "owner/$REPO_NAME" >/dev/null
deploy place --site "$RUN2/site" --repo "$REPO_NAME" --channel dev \
  --dist "$TEMPLATE_DIR/dist" --sha dev1234 --ref refs/heads/dev
deploy finalize --site "$RUN2/site" --push --commit-message "deploy: dev @ dev1234"

test -f "$RUN2/site/dev/version.json" || { echo "::error::dev/version.json missing"; exit 1; }
node -e 'const m = require(process.argv[1]); if (m.published !== false || m.gristWidgetSdk?.channel !== "dev") process.exit(1)' \
  "$RUN2/site/dev/grist-widget.json" || { echo "::error::dev/grist-widget.json missing or not marked dev"; exit 1; }
grep -q "grist-widget-sdk dev channel" "$RUN2/site/dev/index.html" || { echo "::error::self-reload snippet missing"; exit 1; }

echo "== 5/11 concurrent push: finalize must rebase-and-retry, not lose either commit"
RUN3="$WORK/run3"
git clone -q --branch gh-pages "$WORK/bare.git" "$RUN3/site"
git -C "$RUN3/site" config user.name "github-actions[bot]"
git -C "$RUN3/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git clone -q --branch gh-pages "$WORK/bare.git" "$WORK/interloper"
echo "concurrent change" > "$WORK/interloper/concurrent.txt"
git -C "$WORK/interloper" add -A
git -C "$WORK/interloper" -c user.name=interloper -c user.email=i@i.com commit -q -m "concurrent push"
git -C "$WORK/interloper" push -q origin gh-pages

echo "my change" > "$RUN3/site/scratch-marker.txt"
FINALIZE_OUT="$(deploy finalize --site "$RUN3/site" --push --commit-message "deploy: concurrent-retry check" 2>&1)"
echo "$FINALIZE_OUT"
echo "$FINALIZE_OUT" | grep -q '"pushed":true' || { echo "::error::finalize did not report a successful push"; exit 1; }
test -f "$RUN3/site/concurrent.txt" || { echo "::error::the concurrent commit's file is missing after rebase"; exit 1; }
test -f "$RUN3/site/scratch-marker.txt" || { echo "::error::our own commit's file is missing after rebase"; exit 1; }

echo "== 6/11 foreign content: a gh-pages manually seeded from another repo's export must not count as already-published"
FOREIGN="$WORK/foreign-bare.git"
git init --bare -q "$FOREIGN"
FOREIGN_SEED="$WORK/foreign-seed"
mkdir -p "$FOREIGN_SEED/v$VERSION"
echo "<html>foreign content</html>" > "$FOREIGN_SEED/v$VERSION/index.html"
node -e '
  const fs = require("fs");
  fs.writeFileSync(
    process.argv[1],
    JSON.stringify({ version: process.argv[2], publishedAt: new Date().toISOString(), sha: "deadbee", repo: "some-other-repo" }, null, 2) + "\n"
  );
' "$FOREIGN_SEED/v$VERSION/showcase-meta.json" "$VERSION"
touch "$FOREIGN_SEED/.nojekyll"
git -C "$FOREIGN_SEED" init -q -b gh-pages
git -C "$FOREIGN_SEED" add -A
git -C "$FOREIGN_SEED" -c user.name=foreign -c user.email=foreign@test.com commit -q -m "seed from another repo"
git -C "$FOREIGN_SEED" remote add origin "$FOREIGN"
git -C "$FOREIGN_SEED" push -q origin gh-pages

RUN5="$WORK/run5"
git clone -q --branch gh-pages "$FOREIGN" "$RUN5/site"
git -C "$RUN5/site" config user.name "github-actions[bot]"
git -C "$RUN5/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
PLAN5="$(deploy plan --site "$RUN5/site" --repo "$REPO_NAME" --event push --ref refs/heads/main)"
echo "   plan: $PLAN5"
node -e '
  const p = JSON.parse(process.argv[1]);
  if (p.skip !== false || p.reason !== "new-version") { console.error("expected skip=false, new-version -- foreign showcase-meta.json must not count as already-published"); process.exit(1); }
' "$PLAN5"

echo "== 7/11 first-release cleanup: a repo copied with 'Include all branches' clears foreign versions on its first genuine release"
CLEANUP_BARE="$WORK/cleanup-bare.git"
git init --bare -q "$CLEANUP_BARE"
CLEANUP_SEED="$WORK/cleanup-seed"
mkdir -p "$CLEANUP_SEED/v9.0.0" "$CLEANUP_SEED/v9.1.0"
echo "<html>foreign v9.0.0</html>" > "$CLEANUP_SEED/v9.0.0/index.html"
node -e '
  const fs = require("fs");
  fs.writeFileSync(
    process.argv[1],
    JSON.stringify({ version: "9.0.0", publishedAt: new Date().toISOString(), sha: "aaa1111", repo: "grist-widget-template" }, null, 2) + "\n"
  );
' "$CLEANUP_SEED/v9.0.0/showcase-meta.json"
echo "<html>foreign v9.1.0, no meta at all</html>" > "$CLEANUP_SEED/v9.1.0/index.html"
# The source repo's own root + latest/, still pointing at ITS base path --
# blank on this repo's Pages site until cleared. Broadened cleanup must wipe
# these too, not just v<version>/ dirs.
echo "<html>foreign root, points at the source repo's own path</html>" > "$CLEANUP_SEED/index.html"
mkdir -p "$CLEANUP_SEED/latest"
echo "<html>foreign latest, points at the source repo's own path</html>" > "$CLEANUP_SEED/latest/index.html"
touch "$CLEANUP_SEED/.nojekyll"
git -C "$CLEANUP_SEED" init -q -b gh-pages
git -C "$CLEANUP_SEED" add -A
git -C "$CLEANUP_SEED" -c user.name=foreign -c user.email=foreign@test.com commit -q -m "seed via Use this template + Include all branches"
git -C "$CLEANUP_SEED" remote add origin "$CLEANUP_BARE"
git -C "$CLEANUP_SEED" push -q origin gh-pages

RUN6="$WORK/run6"
git clone -q --branch gh-pages "$CLEANUP_BARE" "$RUN6/site"
git -C "$RUN6/site" config user.name "github-actions[bot]"
git -C "$RUN6/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

deploy place --site "$RUN6/site" --repo "$REPO_NAME" --channel release --version "$VERSION" \
  --dist "$TEMPLATE_DIR/dist" --sha cleanup1 --ref refs/heads/main
deploy finalize --site "$RUN6/site" --repo "$REPO_NAME" --update-versions --push --commit-message "deploy: release @ cleanup1"

test ! -e "$RUN6/site/v9.0.0" || { echo "::error::foreign v9.0.0/ was not cleaned up on this repo's first genuine release"; exit 1; }
test ! -e "$RUN6/site/v9.1.0" || { echo "::error::foreign v9.1.0/ was not cleaned up on this repo's first genuine release"; exit 1; }
grep -q "foreign root" "$RUN6/site/index.html" && { echo "::error::foreign root index.html survived first genuine release -- it now points at this repo's own build"; exit 1; }
grep -q "foreign latest" "$RUN6/site/latest/index.html" && { echo "::error::foreign latest/ survived first genuine release"; exit 1; }
test -f "$RUN6/site/v$VERSION/index.html" || { echo "::error::v$VERSION/index.html missing after cleanup"; exit 1; }
test -f "$RUN6/site/index.html" || { echo "::error::site root index.html (this repo's own hub) missing after cleanup"; exit 1; }
test -f "$RUN6/site/latest/index.html" || { echo "::error::latest/ (this repo's own) missing after cleanup"; exit 1; }
grep -q "\"9.0.0\"" "$RUN6/site/versions.json" && { echo "::error::foreign version 9.0.0 leaked into versions.json"; exit 1; }
grep -q "\"$VERSION\"" "$RUN6/site/versions.json" || { echo "::error::versions.json missing $VERSION after cleanup"; exit 1; }

echo "== 8/11 first-release version reset: a contaminated package.json version must not leak into the first genuine release"
# Simulates the real bug: grist-widget-template's own main branch had been
# promoted from canary/latest, whose package.json is deliberately stamped
# with whatever create-grist-widget version was current (e.g. "0.2.18") --
# so a repo freshly copied via "Use this template" inherited that as its
# OWN version instead of starting fresh at 0.0.1.
CONTAMINATED_BARE="$WORK/contaminated-bare.git"
git init --bare -q "$CONTAMINATED_BARE"
RUN7="$WORK/run7"
git clone -q "$CONTAMINATED_BARE" "$RUN7/site"
git -C "$RUN7/site" checkout --orphan gh-pages -q
git -C "$RUN7/site" rm -rf . >/dev/null 2>&1 || true
touch "$RUN7/site/.nojekyll"
git -C "$RUN7/site" add -A
git -C "$RUN7/site" -c user.name=test -c user.email=test@test.com commit -q -m "init gh-pages"
git -C "$RUN7/site" push -q origin gh-pages
git -C "$RUN7/site" config user.name "github-actions[bot]"
git -C "$RUN7/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  pkg.version = "0.2.18";
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$TEMPLATE_DIR/package.json"
PLAN7="$(deploy plan --site "$RUN7/site" --repo "$REPO_NAME" --event push --ref refs/heads/main)"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  pkg.version = "0.0.1";
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$TEMPLATE_DIR/package.json"
echo "   plan: $PLAN7"
node -e '
  const p = JSON.parse(process.argv[1]);
  if (p.version !== "0.0.1") { console.error("expected a repo'"'"'s first genuine release to resolve to 0.0.1 regardless of package.json'"'"'s version, got " + p.version); process.exit(1); }
' "$PLAN7"

echo "== 9/11 first-release reset: personalize identity, version -> 0.0.1, prune stray branches, reset dev to main"
# Simulates a repo copied via "Use this template" -> "Include all branches":
# main (carrying the source template's own untouched placeholder identity in
# all four spots, plus its inherited canary version 0.2.23), an unrelated
# foreign dev, a stray canary/latest branch, and gh-pages all inherited
# verbatim. resetBranchesIfFirstRelease establishes the state every widget
# should start from: the four placeholder-identity spots rewritten to the
# real repo name, package.json version back to 0.0.1 (so the next release
# bumps to 0.0.2, not 0.2.24), main == dev, gh-pages untouched, nothing else
# survives.
SOURCE_BARE="$WORK/source-bare.git"
git init --bare -q -b main "$SOURCE_BARE"
SOURCE_SEED="$WORK/source-seed"
git clone -q "$SOURCE_BARE" "$SOURCE_SEED"
git -C "$SOURCE_SEED" config user.name test
git -C "$SOURCE_SEED" config user.email test@test.com
mkdir -p "$SOURCE_SEED/src/app"
# main carries the template's own untouched placeholder identity (name,
# README heading, index.html title, App.tsx title) and an inherited canary
# version -- exactly what a "Use this template" copy of
# grist-widget-template's own main ships, since that copy never runs the
# CLI's rename step.
echo '{ "name": "grist-widget-template-vite", "version": "0.2.23" }' > "$SOURCE_SEED/package.json"
printf '%s\n' "# grist-widget-template-vite" "" "Starter template." "" \
  "<!-- install-url:start -->" "**Install URL**: written here by this widget's first release." "<!-- install-url:end -->" \
  > "$SOURCE_SEED/README.md"
cat > "$SOURCE_SEED/index.html" <<'HTML'
<!doctype html>
<html>
  <head>
    <title>Grist Widget</title>
  </head>
  <body></body>
</html>
HTML
cat > "$SOURCE_SEED/src/app/App.tsx" <<'TSX'
export const WIDGET_METADATA = {
  title: "Grist Widget Template",
  description: "placeholder",
} as const
TSX
# Where a copy of an older template repository keeps it, before the src/app/
# layout: both are personalized (a real repo has one or the other).
cp "$SOURCE_SEED/src/app/App.tsx" "$SOURCE_SEED/src/App.tsx"
git -C "$SOURCE_SEED" add -A
git -C "$SOURCE_SEED" commit -q -m "Initial commit"
git -C "$SOURCE_SEED" push -q origin main

git -C "$SOURCE_SEED" checkout -q -b dev
echo '{ "name": "ask-genial-widget", "version": "0.2.23", "dev": true }' > "$SOURCE_SEED/package.json"
git -C "$SOURCE_SEED" commit -q -am "Initialize dev (foreign)"
git -C "$SOURCE_SEED" push -q origin dev

git -C "$SOURCE_SEED" checkout -q main
git -C "$SOURCE_SEED" checkout -q -b canary/latest
git -C "$SOURCE_SEED" push -q origin canary/latest

git -C "$SOURCE_SEED" checkout -q --orphan gh-pages
git -C "$SOURCE_SEED" rm -rf . >/dev/null 2>&1 || true
touch "$SOURCE_SEED/.nojekyll"
git -C "$SOURCE_SEED" add -A
git -C "$SOURCE_SEED" commit -q -m "gh-pages"
git -C "$SOURCE_SEED" push -q origin gh-pages

# The workflow's own checkout at the moment this runs: main's tip.
RUN8="$WORK/run8"
git clone -q --branch main "$SOURCE_BARE" "$RUN8"
git -C "$RUN8" config user.name "github-actions[bot]"
git -C "$RUN8" config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# GITHUB_REPOSITORY is what Actions sets; reset-branches reads it for the
# install URL it writes into README.md.
( export GITHUB_REPOSITORY=SomeOwner/ask-genial-widget; deploy reset-branches --repo-dir "$RUN8" --repo ask-genial-widget )

REMAINING="$(git ls-remote --heads "$SOURCE_BARE" | sed 's#.*refs/heads/##' | sort | tr '\n' ' ')"
echo "   remaining branches: $REMAINING"
echo "$REMAINING" | grep -q "canary/latest" && { echo "::error::stray canary/latest branch was not pruned"; exit 1; }
echo "$REMAINING" | grep -q "gh-pages" || { echo "::error::gh-pages branch was removed -- must never be touched"; exit 1; }
echo "$REMAINING" | grep -q "main" || { echo "::error::main branch is gone"; exit 1; }
echo "$REMAINING" | grep -qw "dev" || { echo "::error::dev branch is gone"; exit 1; }

MAIN_SHA="$(git ls-remote "$SOURCE_BARE" refs/heads/main | cut -f1)"
DEV_SHA="$(git ls-remote "$SOURCE_BARE" refs/heads/dev | cut -f1)"
[ "$MAIN_SHA" = "$DEV_SHA" ] || { echo "::error::dev was not reset to match main (main=$MAIN_SHA dev=$DEV_SHA)"; exit 1; }

# main's package.json version must now read 0.0.1, on both main and dev.
git clone -q --branch main "$SOURCE_BARE" "$WORK/verify-main"
MAIN_VER="$(node -p "require('$WORK/verify-main/package.json').version")"
echo "   main package.json version after reset: $MAIN_VER"
[ "$MAIN_VER" = "0.0.1" ] || { echo "::error::package.json version was not reset to 0.0.1 (got $MAIN_VER)"; exit 1; }

# The four placeholder-identity spots must now read the real repo name
# ("ask-genial-widget" -> title "Ask Genial Widget"), the piece "Use this
# template" itself never fixes.
MAIN_NAME="$(node -p "require('$WORK/verify-main/package.json').name")"
echo "   package.json name after reset: $MAIN_NAME"
[ "$MAIN_NAME" = "ask-genial-widget" ] || { echo "::error::package.json name was not personalized (got $MAIN_NAME)"; exit 1; }
grep -q "^# ask-genial-widget" "$WORK/verify-main/README.md" || { echo "::error::README.md heading was not personalized"; exit 1; }
# R1: the install URL, with the owner lowercased as GitHub Pages serves it,
# so the widget can be registered.
grep -qF "<https://someowner.github.io/ask-genial-widget/latest/>" "$WORK/verify-main/README.md" || { echo "::error::README.md install URL was not written on the first release"; exit 1; }
grep -q "<title>Ask Genial Widget</title>" "$WORK/verify-main/index.html" || { echo "::error::index.html <title> was not personalized"; exit 1; }
grep -q 'title: "Ask Genial Widget",' "$WORK/verify-main/src/app/App.tsx" || { echo "::error::src/app/App.tsx WIDGET_METADATA title was not personalized"; exit 1; }
grep -q 'title: "Ask Genial Widget",' "$WORK/verify-main/src/App.tsx" || { echo "::error::src/App.tsx (older layout) WIDGET_METADATA title was not personalized"; exit 1; }

echo "== 10/11 remove: dev/ retires, v<version>/ and latest/ are untouched"
RUN4="$WORK/run4"
git clone -q --branch gh-pages "$WORK/bare.git" "$RUN4/site"
git -C "$RUN4/site" config user.name "github-actions[bot]"
git -C "$RUN4/site" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
deploy remove --site "$RUN4/site"
deploy finalize --site "$RUN4/site" --push --commit-message "cleanup: retire dev URL"

test ! -e "$RUN4/site/dev" || { echo "::error::dev/ still present after remove"; exit 1; }
test -f "$RUN4/site/v$VERSION/index.html" || { echo "::error::release v$VERSION/ was removed by cleanup"; exit 1; }
test -f "$RUN4/site/latest/index.html" || { echo "::error::latest/ was removed by cleanup"; exit 1; }
test -f "$RUN4/site/versions.json" || { echo "::error::versions.json was removed by cleanup"; exit 1; }

echo "== 11/11 OK: template's bundled deploy pipeline builds, places, skips, self-reloads, retries, and retires correctly"
