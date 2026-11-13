// Which package manager installs a new widget's dependencies.
//
// The scaffold is a pnpm project: its workflows install with pnpm, and
// pnpm-workspace.yaml holds settings only pnpm reads (build-script
// approvals, release-age exceptions). So the CLI installs with pnpm
// whichever package manager runs it -- `npm create grist-widget` runs it
// under npm. Installing with npm would commit a package-lock.json that the
// workflows never read, and skip pnpm's 24 h release-age check.

/**
 * @param {{ noInstall?: boolean, pm?: string | null, hasPnpm: () => boolean }} options
 *   `pm` is an explicit `--pm`; `hasPnpm` is only called when pnpm is the pick.
 * @returns {{ manager: string } | { skip: "no-install" | "no-pnpm" }}
 */
export function installPlan({ noInstall, pm, hasPnpm }) {
  if (noInstall) return { skip: "no-install" }
  if (pm) return { manager: pm }
  return hasPnpm() ? { manager: "pnpm" } : { skip: "no-pnpm" }
}
