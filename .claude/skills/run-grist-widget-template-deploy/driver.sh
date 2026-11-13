#!/usr/bin/env bash
# Live verification driver for grist-widget-sdk's scaffolded-template deploy
# pipeline (create-grist-widget -> .github/workflows/deploy.yml, bundled into
# every `npm create grist-widget` scaffold, running the CLI's own
# grist-widget-deploy command as a devDependency).
#
# Scaffolds a real widget from the published npm package, pushes it to a
# real GitHub repo, and polls the resulting public Pages URLs until the
# release channel (/v<version>/, /latest/) and dev channel (/dev/, with
# self-reload) both come up. No GitHub API token or `gh` CLI required —
# only `git` (against a remote you already have push access to) and `curl`
# against public Pages URLs.
#
# Usage:
#   bash driver.sh <widget-name> <git-remote-url>
#
# Run from the parent directory where you want the new project folder
# created (matching how a human would run `npm create grist-widget`
# directly) — <widget-name> is a bare name (lowercase/digits/hyphens only,
# no path), not a path; the CLI itself rejects anything else.
# <git-remote-url> is the target repo, e.g.
#   https://github.com/<owner>/<repo>.git
#
# Two points in this script require a MANUAL step in the GitHub UI that
# nothing here can do for you (see SKILL.md for why) — the script pauses
# and tells you exactly what to click each time.
set -euo pipefail

TARGET_DIR="${1:?Usage: bash driver.sh <widget-name> <git-remote-url>}"
REMOTE_URL="${2:?Usage: bash driver.sh <widget-name> <git-remote-url>}"

if [ -e "$TARGET_DIR" ]; then
  echo "::error::$TARGET_DIR already exists — pick a fresh name or remove it first"
  exit 1
fi

OWNER_REPO="$(echo "$REMOTE_URL" | sed -E 's#.*[:/]([^/]+)/([^/.]+)(\.git)?$#\1/\2#')"
OWNER="$(echo "$OWNER_REPO" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]')"
REPO="$(echo "$OWNER_REPO" | cut -d/ -f2)"
LATEST_URL="https://${OWNER}.github.io/${REPO}/latest/"
DEV_URL="https://${OWNER}.github.io/${REPO}/dev/"

echo "== 1/6 scaffold via the real published npm package"
npm create grist-widget@latest "$TARGET_DIR"
# npm's own `create-*` convention name-mangles the string after `grist-widget`
# and passes it as argv[1] to the CLI verbatim — a bare name works, a path does not.
cd "$TARGET_DIR"
VERSION="$(node -p "require('./package.json').version")"
RELEASE_URL="https://${OWNER}.github.io/${REPO}/v${VERSION}/"

echo
echo "== 2/6 MANUAL STEP — do this now, before the first push =="
echo "In https://github.com/${OWNER_REPO}/settings/actions:"
echo '  Workflow permissions -> "Read and write permissions" -> Save.'
echo "(New repos often default this to read-only, which makes the deploy"
echo " workflow's push to gh-pages fail with a 403 on its very first run.)"
read -r -p "Press Enter once that's saved... "

echo "== 3/6 push to main"
git init -q -b main
git add -A
git -c user.name="live-deploy-check" -c user.email="live-deploy-check@localhost" commit -q -m "scaffold: initial widget"
git remote add origin "$REMOTE_URL"
git push -u origin main || git push -u origin main --force
# --force fallback: only for a designated fresh throwaway test repo (see
# SKILL.md) that may have been initialized with a README/license via
# GitHub's "create repository" UI, which conflicts with this being main's
# very first real commit.

echo "== 4/6 wait for the deploy workflow's first run to create gh-pages"
echo "   polling: git ls-remote $REMOTE_URL gh-pages"
for i in $(seq 1 40); do
  if git ls-remote "$REMOTE_URL" gh-pages 2>/dev/null | grep -q gh-pages; then
    echo "   gh-pages branch exists"
    break
  fi
  sleep 15
done
git ls-remote "$REMOTE_URL" gh-pages | grep -q gh-pages || {
  echo "::error::gh-pages branch never appeared — check https://github.com/${OWNER_REPO}/actions for the failed run"
  exit 1
}

echo
echo "== 5/6 MANUAL STEP — do this now, gh-pages exists =="
echo "In https://github.com/${OWNER_REPO}/settings/pages:"
echo '  Source -> "Deploy from a branch" -> Branch: gh-pages, folder / (root) -> Save.'
echo "(Can only be set once the branch exists, which is why this step is"
echo " second, not first. NOT main -- that serves the raw unbuilt source and"
echo " shows a blank page with a /src/main.tsx 404 in the console.)"
read -r -p "Press Enter once that's saved... "

echo "== 6/6 poll the public URLs, then check the dev channel"
echo "   waiting for $LATEST_URL (Pages activation can take a minute or two)"
CODE=000
for i in $(seq 1 40); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "$LATEST_URL" || echo 000)"
  [ "$CODE" = "200" ] && break
  sleep 15
done
echo "   $LATEST_URL -> $CODE"
[ "$CODE" = "200" ] || { echo "::error::latest/ never came up"; exit 1; }

CODE2="$(curl -s -o /dev/null -w '%{http_code}' "$RELEASE_URL")"
echo "   $RELEASE_URL -> $CODE2"
[ "$CODE2" = "200" ] || { echo "::error::v$VERSION/ did not come up"; exit 1; }

echo "   pushing a dev branch to exercise the dev channel"
git checkout -q -b dev
git push -u origin dev

for i in $(seq 1 40); do
  CODE3="$(curl -s -o /dev/null -w '%{http_code}' "$DEV_URL" || echo 000)"
  [ "$CODE3" = "200" ] && break
  sleep 15
done
echo "   $DEV_URL -> $CODE3"
[ "$CODE3" = "200" ] || { echo "::error::dev/ never came up"; exit 1; }

echo "   checking dev/ carries version.json + the self-reload snippet"
curl -sf "${DEV_URL}version.json" || { echo "::error::dev/version.json missing"; exit 1; }
echo
curl -s "$DEV_URL" | grep -q "grist-widget-sdk dev channel" \
  && echo "   self-reload snippet present" \
  || { echo "::error::self-reload snippet missing from dev/"; exit 1; }

echo
echo "== OK — release + dev channels are both live:"
echo "   $RELEASE_URL"
echo "   $LATEST_URL"
echo "   $DEV_URL"
