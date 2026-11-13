/**
 * Where a deployed build is being served from.
 *
 * A widget's deploy pipeline publishes the same build at its root and at
 * `/latest/`, a preview at `/dev/`, and each release at `/v<version>/`, all
 * under one base path (e.g. `/my-widget/` on GitHub Pages). Opened outside
 * Grist, the page tells them apart from `window.location.pathname` alone.
 */
export type DeployChannel =
  | { kind: "latest" }
  | { kind: "dev" }
  | { kind: "version"; version: string }

export type DeployPath = {
  channel: DeployChannel
  /**
   * The path the channels live under, always ending in `/`: the current
   * path without its channel segment. `"/my-widget/v1.2.0/"` gives
   * `"/my-widget/"`.
   */
  basePath: string
}

const VERSION_SEGMENT = /^v(\d+\.\d+\.\d+(?:-[\w.]+)?)$/

/**
 * Parse a pathname into its deploy channel and base path. A path without a
 * channel segment (the deployed root, or a local dev server) is `latest`:
 * the deploy places the latest release at the root too.
 */
export function parseDeployPath(pathname: string): DeployPath {
  const segments = pathname.replace(/\/+$/, "").split("/")
  const last = segments[segments.length - 1] ?? ""

  let channel: DeployChannel | null = null
  if (last === "latest") channel = { kind: "latest" }
  else if (last === "dev") channel = { kind: "dev" }
  else {
    const match = VERSION_SEGMENT.exec(last)
    if (match) channel = { kind: "version", version: match[1] }
  }

  if (!channel) return { channel: { kind: "latest" }, basePath: withTrailingSlash(pathname) }
  return { channel, basePath: withTrailingSlash(segments.slice(0, -1).join("/")) }
}

/** `"latest"`, `"dev"` or `"v1.2.0"`. */
export function deployChannelLabel(channel: DeployChannel): string {
  return channel.kind === "version" ? `v${channel.version}` : channel.kind
}

function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`
}
