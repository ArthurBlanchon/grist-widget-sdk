// pnpm 11 won't install a dependency version published less than 24 h ago
// (`minimumReleaseAge`). When nothing older satisfies a range, its loose mode
// installs that version anyway and records an exception under
// `minimumReleaseAgeExclude` in pnpm-workspace.yaml. In practice that is only
// grist-widget-sdk, which a fresh scaffold pins to the version released with
// this CLI; every other dependency has an older version in range.
//
// A lockfile pinning that version is then rejected by every later install,
// local or CI, unless the exception stays. So the scaffold's first commit
// keeps it (docs/history/2026-11-01-widget-lifecycle-plan.md, D3), and these
// helpers find the entries pnpm added so the CLI can say why.

const KEY = "minimumReleaseAgeExclude"

/**
 * Entries listed under `minimumReleaseAgeExclude` in a pnpm-workspace.yaml,
 * in block (`- name@version`) or flow (`[a, b]`) style.
 *
 * @param {string} workspaceYaml
 * @returns {string[]}
 */
export function ageExceptions(workspaceYaml) {
  const out = []
  let inBlock = false
  for (const line of workspaceYaml.split(/\r?\n/)) {
    const flow = line.match(new RegExp(`^${KEY}:\\s*\\[(.*)\\]\\s*(#.*)?$`))
    if (flow) {
      for (const item of flow[1].split(",")) {
        const entry = item.trim().replace(/^["']|["']$/g, "")
        if (entry) out.push(entry)
      }
      inBlock = false
      continue
    }
    if (new RegExp(`^${KEY}:\\s*(#.*)?$`).test(line)) {
      inBlock = true
      continue
    }
    if (!inBlock) continue
    const item = line.match(/^\s+-\s+["']?([^"'\s#]+)["']?/)
    if (item) {
      out.push(item[1])
      continue
    }
    if (/^\s*(#.*)?$/.test(line)) continue // blank line or comment inside the block
    inBlock = false
  }
  return out
}

/**
 * Exceptions present in `after` but not in `before`.
 *
 * @param {string} before pnpm-workspace.yaml before the install
 * @param {string} after pnpm-workspace.yaml after it
 * @returns {string[]}
 */
export function addedAgeExceptions(before, after) {
  const had = new Set(ageExceptions(before))
  return ageExceptions(after).filter((entry) => !had.has(entry))
}
