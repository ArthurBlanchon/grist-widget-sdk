import { useState, type CSSProperties } from "react"

import { deployChannelLabel, parseDeployPath, type DeployChannel } from "../deploy-path"
import { useReleasedVersions } from "../released-versions"
import {
  cardStyle,
  cardTextStyle,
  cardTitleStyle,
  codeStyle,
  eyebrowStyle,
  headingStyle,
  leadStyle,
  pageStyle,
  tokens,
} from "./tokens"
import { widgetTitle } from "./widget-title"

/**
 * Shown outside Grist on a deployed URL (`/latest/`, `/dev/`, `/v<version>/`
 * or the root): which build this is, links to the others, and the URL to
 * paste into a Grist custom widget.
 */
export function ReleasePage({ channel }: { channel: DeployChannel }) {
  const label = deployChannelLabel(channel)
  return (
    <main style={pageStyle}>
      <p style={eyebrowStyle}>
        {widgetTitle()} · {label}
      </p>
      <h1 style={headingStyle}>Grist isn't loaded here</h1>
      <p style={leadStyle}>
        This is the <code style={codeStyle}>{label}</code> build, opened outside Grist. Hover a version to see when it
        was released.
      </p>
      <ChannelLinks current={channel} />
      <InstallUrl />
    </main>
  )
}

function ChannelLinks({ current }: { current: DeployChannel }) {
  const { basePath } = parseDeployPath(window.location.pathname)
  const { versions } = useReleasedVersions()
  const isCurrent = (channel: DeployChannel) =>
    channel.kind === current.kind && (channel.kind !== "version" || (current.kind === "version" && channel.version === current.version))

  return (
    <nav aria-label="Versions" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.5rem", marginBottom: "2rem" }}>
      <ChannelLink href={`${basePath}latest/`} active={isCurrent({ kind: "latest" })}>
        latest
      </ChannelLink>
      <ChannelLink href={`${basePath}dev/`} active={isCurrent({ kind: "dev" })}>
        dev
      </ChannelLink>
      {versions?.map((v) => (
        <ChannelLink
          key={v.version}
          href={`${basePath}v${v.version}/`}
          title={formatDate(v.publishedAt)}
          active={isCurrent({ kind: "version", version: v.version })}
        >
          {`v${v.version}`}
        </ChannelLink>
      ))}
    </nav>
  )
}

function ChannelLink({
  href,
  title,
  active,
  children,
}: {
  href: string
  title?: string
  active: boolean
  children: string
}) {
  const style: CSSProperties = {
    padding: "0.25rem 0.75rem",
    border: `1px solid ${active ? tokens.primary : tokens.border}`,
    borderRadius: "9999px",
    background: active ? tokens.primary : "transparent",
    color: active ? tokens.primaryForeground : tokens.mutedForeground,
    fontSize: "0.75rem",
    fontWeight: 500,
    textDecoration: "none",
  }
  return (
    <a href={href} title={title} aria-current={active ? "page" : undefined} style={style}>
      {children}
    </a>
  )
}

function InstallUrl() {
  const url = window.location.href
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <section style={cardStyle}>
      <h2 style={cardTitleStyle}>Use it as a Grist custom widget</h2>
      <p style={{ ...cardTextStyle, marginBottom: "1rem" }}>Paste this URL into a custom widget's URL field in Grist.</p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          readOnly
          value={url}
          aria-label="Widget URL"
          onFocus={(event) => event.target.select()}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "0.5rem 0.75rem",
            border: `1px solid ${tokens.border}`,
            borderRadius: tokens.radius,
            background: "transparent",
            color: tokens.foreground,
            font: "inherit",
            fontSize: "0.875rem",
          }}
        />
        <button
          type="button"
          onClick={copy}
          style={{
            padding: "0.5rem 1rem",
            border: "none",
            borderRadius: tokens.radius,
            background: tokens.primary,
            color: tokens.primaryForeground,
            font: "inherit",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}
