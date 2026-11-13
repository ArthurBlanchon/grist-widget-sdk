// Which ci.yml jobs a change needs. Reads the changed paths (one per line)
// on stdin and prints `name=true|false` lines for $GITHUB_OUTPUT.
//
// One rule per job, in one place: before ci.yml each workflow carried its own
// path filter, and a path-filtered required check that doesn't run blocks the
// merge, so docs-only pull requests needed a bypass. Now every job is listed
// here and the `gate` job, which always runs, is the only required check.
//
// A change to a workflow or to this file runs every job: CI checks itself.

const LOCKFILE = "pnpm-lock.yaml"

/** @type {Record<string, (string|RegExp)[]>} */
export const RULES = {
  core: ["packages/core/", LOCKFILE],
  cli: ["packages/create-grist-widget/", LOCKFILE],
  lint: ["apps/www/", "templates/grist-widget-template-vite/", LOCKFILE],
  external_install: ["packages/core/", "templates/grist-widget-template-vite/", "scripts/smoke/", LOCKFILE],
  create_widget: [
    "packages/core/",
    "packages/create-grist-widget/",
    "templates/grist-widget-template-vite/",
    "examples/",
    "scripts/smoke/",
    "scripts/compose-example.mjs",
    LOCKFILE,
  ],
  template_deploy: [
    "packages/create-grist-widget/src/deploy.mjs",
    "packages/create-grist-widget/bin/grist-widget-deploy.mjs",
    "templates/grist-widget-template-vite/.github/workflows/deploy.yml",
    "templates/grist-widget-template-vite/package.json",
    "scripts/smoke/",
    LOCKFILE,
  ],
  real_widgets: ["packages/core/", "packages/create-grist-widget/", "scripts/real-widgets/"],
  size: ["packages/core/", "templates/grist-widget-template-vite/", LOCKFILE],
}

const EVERYTHING = [".github/workflows/", "scripts/ci/"]

const matches = (file, rule) => (rule.endsWith("/") ? file.startsWith(rule) : file === rule)

/** `{ job: boolean }` for a list of changed paths. `null` (unknown diff) runs every job. */
export function changedJobs(files) {
  const all = files === null || files.some((f) => EVERYTHING.some((r) => matches(f, r)))
  return Object.fromEntries(
    Object.entries(RULES).map(([job, rules]) => [job, all || files.some((f) => rules.some((r) => matches(f, r)))])
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let input = ""
  process.stdin.setEncoding("utf8")
  for await (const chunk of process.stdin) input += chunk
  const files = process.argv.includes("--all") ? null : input.split("\n").map((l) => l.trim()).filter(Boolean)
  for (const [job, run] of Object.entries(changedJobs(files))) console.log(`${job}=${run}`)
}
