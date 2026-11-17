/**
 * Where a deployed build is being served from.
 *
 * A widget's deploy pipeline publishes the same build at its root and at
 * `/latest/`, a preview at `/dev/`, and each release at `/v<version>/`, all
 * under one base path (e.g. `/my-widget/` on GitHub Pages). The widget
 * catalog serves each release at `/<version>/` and the newest of each major
 * at `/v<major>/`. Opened outside Grist, the page tells them apart from
 * `window.location.pathname` alone.
 */
export type DeployChannel =
  | { kind: "latest" }
  | { kind: "dev" }
  | { kind: "major"; major: number }
  | { kind: "version"; version: string }

/** A served URL's channel, and the base path its channels share: what {@link parseDeployPath} returns. */
export type DeployPath = {
  channel: DeployChannel
  /**
   * The path the channels live under, always ending in `/`: the current
   * path without its channel segment. `"/my-widget/v1.2.0/"` gives
   * `"/my-widget/"`.
   */
  basePath: string
}

const VERSION_SEGMENT = /^v?(\d+\.\d+\.\d+(?:-[\w.]+)?)$/
const MAJOR_SEGMENT = /^v(\d+)$/

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
    const version = VERSION_SEGMENT.exec(last)
    const major = MAJOR_SEGMENT.exec(last)
    if (version) channel = { kind: "version", version: version[1] }
    else if (major) channel = { kind: "major", major: Number(major[1]) }
  }

  if (!channel) return { channel: { kind: "latest" }, basePath: withTrailingSlash(pathname) }
  return { channel, basePath: withTrailingSlash(segments.slice(0, -1).join("/")) }
}

/** `"latest"`, `"dev"`, `"v1"` (a major's channel) or `"v1.2.0"`. */
export function deployChannelLabel(channel: DeployChannel): string {
  if (channel.kind === "version") return `v${channel.version}`
  if (channel.kind === "major") return `v${channel.major}`
  return channel.kind
}

function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`
}
