#!/usr/bin/env bash
# create-grist-widget CLI smoke test.
#
# Simulates `npm create grist-widget my-widget` against packed tarballs, no
# registry hit: pack the SDK + the CLI, run the CLI's bin straight off its
# tarball (via `npx --package=<tarball>`, since a bare tarball path isn't
# treated as executable by npx — it needs the explicit --package form to
# install it and resolve the `bin` entry), then rewrite the scaffolded
# project's SDK dependency to the packed SDK tarball and build it standalone.
# Also exercises `init` and `upgrade` straight off the same tarball, and
# checks that the retired `list`, `use` and `--example` (ADR 0023) point to
# the catalog.
#
# Run from the repo root:  bash scripts/smoke/create-widget.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

# The CLI commits the scaffold on `main` automatically (see
# bin/create-grist-widget.mjs) — CI runners don't have a global git
# identity configured by default, so without this the CLI's commit would
# silently degrade instead of exercising the happy path this test checks.
export GIT_AUTHOR_NAME="smoke-test" GIT_AUTHOR_EMAIL="smoke-test@localhost"
export GIT_COMMITTER_NAME="smoke-test" GIT_COMMITTER_EMAIL="smoke-test@localhost"

echo "== 1/6 build + pack the SDK"
pnpm --filter grist-widget-sdk run build >/dev/null
SDK_TARBALL="$(cd "$REPO_ROOT/packages/core" && pnpm pack --pack-destination "$WORK" | tail -1)"
test -f "$SDK_TARBALL" || { echo "::error::SDK pack did not produce a tarball"; exit 1; }

echo "== 2/6 build + pack the CLI (embeds the template + stamps the SDK version)"
pnpm --filter create-grist-widget run build >/dev/null
CLI_TARBALL="$(cd "$REPO_ROOT/packages/create-grist-widget" && pnpm pack --pack-destination "$WORK" | tail -1)"
test -f "$CLI_TARBALL" || { echo "::error::CLI pack did not produce a tarball"; exit 1; }

echo "== 3/6 scaffold via the packed CLI tarball, outside the workspace"
# --no-install: `create`'s own post-scaffold install (batch H, closes C-03)
# would otherwise try to fetch grist-widget-sdk's real registry version
# before step 4 below has a chance to rewrite the dependency to the packed
# tarball -- wasteful at best, and wrong (installs a different SDK build
# than the one this test means to prove against) at worst. Step 5 already
# runs its own `pnpm install` after that rewrite.
PROJECT_PARENT="$WORK/consumer"
mkdir -p "$PROJECT_PARENT"
( cd "$PROJECT_PARENT" && npx --yes --package="$CLI_TARBALL" create-grist-widget my-widget --no-install )
PROJECT="$PROJECT_PARENT/my-widget"
test -f "$PROJECT/package.json" || { echo "::error::scaffold did not produce a project"; exit 1; }

echo "   checking the scaffold has a real .gitignore and a packageManager field"
test -f "$PROJECT/.gitignore" || { echo "::error::.gitignore missing (npm strips a literal .gitignore from published packages — see build-template.mjs)"; exit 1; }
test ! -e "$PROJECT/_gitignore" || { echo "::error::_gitignore leftover — rename to .gitignore didn't happen"; exit 1; }
grep -q '"packageManager"' "$PROJECT/package.json" || { echo "::error::packageManager missing — bundled deploy.yml's pnpm/action-setup step would fail with 'No pnpm version is specified'"; exit 1; }

echo "   checking the bundled workflows tolerate a scaffold with no committed lockfile"
# This scaffold was made with --no-install: its first commit has no
# pnpm-lock.yaml (a default, installing scaffold has one -- checked below).
# --no-install stays supported, so the bundled workflows must keep working
# without a lockfile. `actions/setup-node`'s `cache: pnpm` and
# `pnpm install --frozen-lockfile` both hard-require one to exist; a real
# deploy against this exact scaffold state failed with "Dependencies lock
# file is not found" before this check existed.
test ! -f "$PROJECT/pnpm-lock.yaml" || { echo "::error::test setup assumption broken — scaffold unexpectedly has a committed lockfile"; exit 1; }
# deploy.yml runs on the first push; ci.yml on the first pull request
# (Dependabot's included) — both against this same lockfile-less state.
for WORKFLOW in deploy.yml ci.yml; do
  WORKFLOW_YML="$PROJECT/.github/workflows/$WORKFLOW"
  test -f "$WORKFLOW_YML" || { echo "::error::scaffold is missing .github/workflows/$WORKFLOW"; exit 1; }
  # Strip comment lines first (the workflows' own explanatory comments
  # mention both strings in prose — grep the real config only).
  WORKFLOW_CODE="$(grep -v '^\s*#' "$WORKFLOW_YML")"
  ! echo "$WORKFLOW_CODE" | grep -qE '^\s*cache:\s*pnpm\s*$' || { echo "::error::$WORKFLOW's setup-node step has cache: pnpm, which requires a committed pnpm-lock.yaml the scaffold never has"; exit 1; }
  ! echo "$WORKFLOW_CODE" | grep -q -- '--frozen-lockfile' || { echo "::error::$WORKFLOW's install step uses --frozen-lockfile, which fails outright when no lockfile is committed"; exit 1; }
done

echo "   checking Dependabot is configured to open its PRs against dev"
DEPENDABOT_YML="$PROJECT/.github/dependabot.yml"
test -f "$DEPENDABOT_YML" || { echo "::error::scaffold is missing .github/dependabot.yml"; exit 1; }
# One target-branch per ecosystem entry: update PRs follow the dev -> main
# release loop instead of landing on main unreleased.
ENTRIES="$(grep -cE '^\s*- package-ecosystem:' "$DEPENDABOT_YML")"
DEV_TARGETS="$(grep -cE '^\s*target-branch:\s*"?dev"?\s*$' "$DEPENDABOT_YML")"
[ "$ENTRIES" -gt 0 ] && [ "$ENTRIES" = "$DEV_TARGETS" ] || { echo "::error::dependabot.yml has $ENTRIES ecosystem entries but $DEV_TARGETS target-branch: dev lines"; exit 1; }

echo "   checking a default (installing) scaffold commits its pnpm lockfile in the first commit"
# The CLI installs before its first commit, so pnpm-lock.yaml is part of it
# (docs/history/2026-11-01-widget-lifecycle-plan.md, U4) -- with pnpm even
# when npm runs the CLI, as `npm create grist-widget` (and this npx call)
# does: the workflows only read pnpm-lock.yaml (U4b). No --pm here, so this
# is the documented path. Needs the SDK version the CLI pins on npm, which
# isn't the case on a Version Packages PR.
SDK_VERSION="$(node -p "require('$REPO_ROOT/packages/core/package.json').version")"
CLI_VERSION="$(node -p "require('$REPO_ROOT/packages/create-grist-widget/package.json').version")"
# The scaffold depends on both, at the versions this CLI pins (S1: the deploy
# command lives in create-grist-widget).
if npm view "grist-widget-sdk@$SDK_VERSION" version >/dev/null 2>&1 &&
   npm view "create-grist-widget@$CLI_VERSION" version >/dev/null 2>&1; then
  INSTALL_PARENT="$WORK/install-consumer"
  mkdir -p "$INSTALL_PARENT"
  ( cd "$INSTALL_PARENT" && npx --yes --package="$CLI_TARBALL" create-grist-widget installed-widget --yes )
  INSTALLED="$INSTALL_PARENT/installed-widget"
  git -C "$INSTALLED" ls-tree --name-only HEAD | grep -qx 'pnpm-lock.yaml' || { echo "::error::an installing scaffold's first commit has no pnpm-lock.yaml"; exit 1; }
  test ! -e "$INSTALLED/package-lock.json" || { echo "::error::the scaffold was installed with npm (package-lock.json), whose lockfile the pnpm workflows never read"; exit 1; }
  [ -z "$(git -C "$INSTALLED" status --porcelain)" ] || { echo "::error::an installing scaffold left an unclean working tree (the install ran after the first commit?)"; exit 1; }
  # D3: an age exception pnpm added on release day may only cover the SDK
  # and CLI versions this CLI pins, never another dependency.
  node --input-type=module -e '
    import { readFileSync } from "node:fs"
    const [helper, file, ...expected] = process.argv.slice(1)
    const { ageExceptions } = await import(helper)
    const extra = ageExceptions(readFileSync(file, "utf8")).filter((e) => !expected.includes(e))
    if (extra.length) {
      console.error(`::error::pnpm-workspace.yaml exempts more than ${expected.join(" and ")} from minimumReleaseAge: ${extra.join(", ")}`)
      process.exit(1)
    }
  ' "$REPO_ROOT/packages/create-grist-widget/src/age-exceptions.mjs" "$INSTALLED/pnpm-workspace.yaml" "grist-widget-sdk@$SDK_VERSION" "create-grist-widget@$CLI_VERSION"
else
  echo "   (skipped: grist-widget-sdk@$SDK_VERSION or create-grist-widget@$CLI_VERSION isn't on npm yet, as on a Version Packages PR)"
fi

echo "   checking a scaffold made without pnpm installs nothing, rather than falling back to npm"
# A pnpm that can't run stands in for a missing one: the CLI's probe
# (`pnpm --version`) fails the same way, and PATH keeps everything else.
NO_PNPM_BIN="$WORK/no-pnpm-bin"
mkdir -p "$NO_PNPM_BIN"
printf '#!/bin/sh\nexit 127\n' > "$NO_PNPM_BIN/pnpm"
chmod +x "$NO_PNPM_BIN/pnpm"
NO_PNPM_PARENT="$WORK/no-pnpm-consumer"
mkdir -p "$NO_PNPM_PARENT"
NO_PNPM_OUT="$( cd "$NO_PNPM_PARENT" && PATH="$NO_PNPM_BIN:$PATH" npx --yes --package="$CLI_TARBALL" create-grist-widget no-pnpm-widget --yes )"
NO_PNPM="$NO_PNPM_PARENT/no-pnpm-widget"
test ! -e "$NO_PNPM/node_modules" || { echo "::error::without pnpm, the CLI still installed dependencies"; exit 1; }
test ! -e "$NO_PNPM/package-lock.json" || { echo "::error::without pnpm, the CLI fell back to npm (package-lock.json)"; exit 1; }
git -C "$NO_PNPM" rev-parse --verify --quiet HEAD >/dev/null || { echo "::error::without pnpm, the CLI made no first commit"; exit 1; }
echo "$NO_PNPM_OUT" | grep -q "pnpm isn't installed" || { echo "::error::without pnpm, the CLI didn't say why nothing was installed"; exit 1; }

echo "   checking the scaffold depends on create-grist-widget for its deploy command"
SCAFFOLD_CLI_DEP="$(node -p "require('$PROJECT/package.json').devDependencies?.['create-grist-widget'] ?? ''")"
[ "$SCAFFOLD_CLI_DEP" = "^$CLI_VERSION" ] || { echo "::error::expected devDependency create-grist-widget '^$CLI_VERSION', got '$SCAFFOLD_CLI_DEP'"; exit 1; }
test ! -e "$PROJECT/scripts/deploy.mjs" || { echo "::error::the scaffold still carries scripts/deploy.mjs (the deploy logic now ships in create-grist-widget)"; exit 1; }
! grep -v '^\s*#' "$PROJECT/.github/workflows/deploy.yml" | grep -q 'scripts/deploy.mjs' || { echo "::error::deploy.yml still calls scripts/deploy.mjs"; exit 1; }

echo "   checking the scaffold records which create-grist-widget version produced it"
SCAFFOLD_CREATE_VERSION="$(node -p "require('$PROJECT/package.json').createGristWidgetVersion")"
[ "$SCAFFOLD_CREATE_VERSION" = "$CLI_VERSION" ] || { echo "::error::expected createGristWidgetVersion '$CLI_VERSION', got '$SCAFFOLD_CREATE_VERSION'"; exit 1; }
SCAFFOLD_VERSION="$(node -p "require('$PROJECT/package.json').version")"
[ "$SCAFFOLD_VERSION" = "0.0.1" ] || { echo "::error::expected a fresh scaffold's own version to stay 0.0.1, got '$SCAFFOLD_VERSION' (createGristWidgetVersion is informational only, never the widget's own version)"; exit 1; }

echo "   checking git is initialized on main with a dev branch, one commit"
test -d "$PROJECT/.git" || { echo "::error::scaffold did not initialize git"; exit 1; }
BRANCH="$(git -C "$PROJECT" branch --show-current)"
[ "$BRANCH" = "main" ] || { echo "::error::expected to be on main, got '$BRANCH' — the deploy workflow only releases from main"; exit 1; }
git -C "$PROJECT" show-ref --verify --quiet refs/heads/dev || { echo "::error::dev branch was not created"; exit 1; }
COMMITS="$(git -C "$PROJECT" rev-list --count HEAD)"
[ "$COMMITS" = "1" ] || { echo "::error::expected exactly 1 commit on main, got $COMMITS"; exit 1; }
[ -z "$(git -C "$PROJECT" status --porcelain)" ] || { echo "::error::scaffold left an unclean working tree"; exit 1; }

echo "== 4/6 rewrite the scaffolded SDK and CLI dependencies to the packed tarballs"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const tarball = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!pkg.dependencies || !pkg.dependencies["grist-widget-sdk"]) {
    console.error("scaffolded package.json has no grist-widget-sdk dependency");
    process.exit(1);
  }
  pkg.dependencies["grist-widget-sdk"] = "file:" + tarball;
  // And the deploy command to the packed CLI, the version this run tests.
  pkg.devDependencies["create-grist-widget"] = "file:" + process.argv[3];
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$PROJECT/package.json" "$SDK_TARBALL" "$CLI_TARBALL"

echo "== 5/6 install + lint + build + test the scaffolded project standalone"
( cd "$PROJECT" && pnpm install )
# The bundled ci.yml lints every pull request: a fresh scaffold must start green.
( cd "$PROJECT" && pnpm run lint )
( cd "$PROJECT" && pnpm run build )
( cd "$PROJECT" && pnpm run test )
# What the bundled deploy.yml runs: the deploy command from the packed CLI.
mkdir -p "$WORK/empty-site"
PLAN="$( cd "$PROJECT" && node_modules/.bin/grist-widget-deploy plan --site "$WORK/empty-site" --repo my-widget --event push --ref refs/heads/dev )"
echo "   deploy plan for dev: $PLAN"
echo "$PLAN" | grep -q '"context":"dev"' || { echo "::error::the scaffold's grist-widget-deploy didn't plan a dev deploy: $PLAN"; exit 1; }

echo "== 6/6 exercise upgrade/init, and the retired list/use/--example, against the packed CLI tarball"

echo "   list, use and --example are retired, pointing to the catalog"
for retired in "list" "use hello-world" "create from-example --example hello-world --yes --no-install"; do
  # shellcheck disable=SC2086
  if OUT="$(cd "$PROJECT_PARENT" && npx --yes --package="$CLI_TARBALL" create-grist-widget $retired 2>&1)"; then
    echo "::error::create-grist-widget $retired should have failed"; exit 1
  fi
  echo "$OUT" | grep -q "gristwidgets.com/widgets/" || { echo "::error::create-grist-widget $retired did not point to the catalog: $OUT"; exit 1; }
done
[ ! -e "$PROJECT_PARENT/from-example" ] || { echo "::error::--example created a project"; exit 1; }

echo "   a scaffold on the packed SDK and CLI lints, builds and tests green"
USE_PARENT="$WORK/upgrade-consumer"
mkdir -p "$USE_PARENT"
( cd "$USE_PARENT" && npx --yes --package="$CLI_TARBALL" create-grist-widget create upgrade-target --yes --no-install )
USE_PROJECT="$USE_PARENT/upgrade-target"
node -e '
  const fs = require("fs");
  const p = process.argv[1];
  const tarball = process.argv[2];
  const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
  pkg.dependencies["grist-widget-sdk"] = "file:" + tarball;
  // The scaffold also depends on the CLI (its deploy command): the packed
  // one, the version this run tests, not yet on npm on a Version Packages PR.
  pkg.devDependencies["create-grist-widget"] = "file:" + process.argv[3];
  fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
' "$USE_PROJECT/package.json" "$SDK_TARBALL" "$CLI_TARBALL"
( cd "$USE_PROJECT" && pnpm install )
( cd "$USE_PROJECT" && pnpm run lint )
( cd "$USE_PROJECT" && pnpm run build )
( cd "$USE_PROJECT" && pnpm run test )

echo "   upgrade"
# Run the way a widget runs it (pnpm exec create-grist-widget upgrade): its
# own installed CLI, here the packed one.
upgrade() { ( cd "$USE_PROJECT" && node_modules/.bin/create-grist-widget upgrade ); }
git -C "$USE_PROJECT" add -A && git -C "$USE_PROJECT" commit -qm "packed dependencies"
if upgrade >/dev/null 2>&1; then echo "::error::upgrade should have refused to run on main"; exit 1; fi
git -C "$USE_PROJECT" switch -q -C dev
echo "// wip" >> "$USE_PROJECT/src/app/App.tsx"
if upgrade >/dev/null 2>&1; then echo "::error::upgrade should have refused a dirty working tree"; exit 1; fi
git -C "$USE_PROJECT" checkout -q -- src/app/App.tsx

# What an older template left behind: an edited and a missing template file,
# a retired one, an older createGristWidgetVersion.
echo "// from an older template" >> "$USE_PROJECT/vite.config.ts"
rm "$USE_PROJECT/.github/workflows/ci.yml"
mkdir -p "$USE_PROJECT/scripts" && echo "// retired" > "$USE_PROJECT/scripts/deploy.mjs"
node -e '
  const fs = require("fs");
  const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  pkg.createGristWidgetVersion = "0.0.1";
  fs.writeFileSync(process.argv[1], JSON.stringify(pkg, null, 2) + "\n");
' "$USE_PROJECT/package.json"
git -C "$USE_PROJECT" add -A && git -C "$USE_PROJECT" commit -qm "an older template"
WIDGET_TREE="$(git -C "$USE_PROJECT" rev-parse HEAD:src/app)"

upgrade
! grep -q "older template" "$USE_PROJECT/vite.config.ts" || { echo "::error::upgrade did not rewrite vite.config.ts"; exit 1; }
test -f "$USE_PROJECT/.github/workflows/ci.yml" || { echo "::error::upgrade did not restore ci.yml"; exit 1; }
[ ! -e "$USE_PROJECT/scripts" ] || { echo "::error::upgrade did not delete the retired scripts/deploy.mjs"; exit 1; }
UPGRADED_VERSION="$(node -p "require('$USE_PROJECT/package.json').createGristWidgetVersion")"
[ "$UPGRADED_VERSION" = "$CLI_VERSION" ] || { echo "::error::upgrade set createGristWidgetVersion to '$UPGRADED_VERSION', expected '$CLI_VERSION'"; exit 1; }
git -C "$USE_PROJECT" add -A
[ -z "$(git -C "$USE_PROJECT" diff --cached --name-only -- src/app src/components/ui src/index.css README.md index.html)" ] || { echo "::error::upgrade touched the widget's own files"; exit 1; }
( cd "$USE_PROJECT" && pnpm run lint && pnpm run build && pnpm run test )
git -C "$USE_PROJECT" commit -qm "upgrade"
[ "$(git -C "$USE_PROJECT" rev-parse HEAD:src/app)" = "$WIDGET_TREE" ] || { echo "::error::upgrade changed src/app/"; exit 1; }
upgrade | grep -q "nothing to change" || { echo "::error::a second upgrade should have had nothing to change"; exit 1; }
[ -z "$(git -C "$USE_PROJECT" status --porcelain)" ] || { echo "::error::a second upgrade changed files"; exit 1; }

git -C "$USE_PROJECT" mv src/app/App.tsx src/App.tsx && git -C "$USE_PROJECT" commit -qm "old layout"
if upgrade >/dev/null 2>&1; then echo "::error::upgrade should have refused a widget still in src/App.tsx"; exit 1; fi
git -C "$USE_PROJECT" reset -q --hard HEAD~1

echo "   init"
INIT_TARGET="$WORK/init-target"
mkdir -p "$INIT_TARGET"
( cd "$INIT_TARGET" && npx --yes --package="$CLI_TARBALL" create-grist-widget init --yes --no-install )
test -f "$INIT_TARGET/src/app/App.tsx" || { echo "::error::init did not scaffold into the current directory"; exit 1; }
test -d "$INIT_TARGET/.git" || { echo "::error::init did not initialize git in a fresh (non-git) directory"; exit 1; }
[ -z "$(git -C "$INIT_TARGET" status --porcelain)" ] || { echo "::error::init left an unclean working tree"; exit 1; }

echo "   init accepts an untouched 'Use this template' copy of a scaffold (its identity files differ, nothing else)"
COPY_SOURCE="$WORK/copy-source"
mkdir -p "$COPY_SOURCE"
( cd "$COPY_SOURCE" && npx --yes --package="$CLI_TARBALL" create-grist-widget create grist-widget-template --yes --no-install )
COPY_TARGET="$WORK/copy-target"
mkdir -p "$COPY_TARGET"
( cd "$COPY_SOURCE/grist-widget-template" && tar --exclude=.git -cf - . ) | ( cd "$COPY_TARGET" && tar -xf - )
( cd "$COPY_TARGET" && npx --yes --package="$CLI_TARBALL" create-grist-widget init --name my-copy --yes --no-install ) \
  || { echo "::error::init refused an untouched copy of a scaffold"; exit 1; }
grep -q "^# my-copy" "$COPY_TARGET/CHANGELOG.md" || { echo "::error::init did not name CHANGELOG.md after the widget"; exit 1; }

echo "   init refuses to overwrite a conflicting file, --force overrides it"
COLLISION_TARGET="$WORK/init-collision"
mkdir -p "$COLLISION_TARGET/src/lib"
echo "// pre-existing, unrelated content" > "$COLLISION_TARGET/src/lib/utils.ts"
if ( cd "$COLLISION_TARGET" && npx --yes --package="$CLI_TARBALL" create-grist-widget init --yes --no-install ) >/dev/null 2>&1; then
  echo "::error::init should have refused a conflicting non-identity file"
  exit 1
fi
( cd "$COLLISION_TARGET" && npx --yes --package="$CLI_TARBALL" create-grist-widget init --yes --no-install --force )
grep -q "clsx" "$COLLISION_TARGET/src/lib/utils.ts" || { echo "::error::init --force did not overwrite the conflicting file"; exit 1; }

echo "   init does not auto-commit into an already-initialized repo"
EXISTING_GIT_TARGET="$WORK/init-existing-git"
mkdir -p "$EXISTING_GIT_TARGET"
( cd "$EXISTING_GIT_TARGET" && git init -q -b main && git commit -q --allow-empty -m "pre-existing history" )
( cd "$EXISTING_GIT_TARGET" && npx --yes --package="$CLI_TARBALL" create-grist-widget init --yes --no-install )
COMMIT_COUNT="$(git -C "$EXISTING_GIT_TARGET" rev-list --count HEAD)"
[ "$COMMIT_COUNT" = "1" ] || { echo "::error::init should not have committed into a repo that already had history (expected 1 commit, got $COMMIT_COUNT)"; exit 1; }
[ -n "$(git -C "$EXISTING_GIT_TARGET" status --porcelain)" ] || { echo "::error::init should have left the scaffold uncommitted (working tree unexpectedly clean)"; exit 1; }

echo "== OK: npm create grist-widget scaffolds a project that installs, lints, builds, and tests green against the packed SDK tarball, init works offline from the same tarball, the retired list/use/--example point to the catalog, and upgrade brings an older widget's template files back in line"
