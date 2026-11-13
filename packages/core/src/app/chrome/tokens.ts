import type { CSSProperties } from "react"

/**
 * The chrome's colours and radius: shadcn's CSS variables, so the pages
 * follow a widget's theme (light, dark, its own palette) without depending
 * on its Tailwind config, with neutral fallbacks for a widget without them.
 * Same approach as GristBoundaryScreen.
 */
const token = (name: string, fallback: string) => `var(--${name}, ${fallback})`

export const tokens = {
  background: token("background", "#ffffff"),
  foreground: token("foreground", "#0a0a0a"),
  card: token("card", "#ffffff"),
  mutedForeground: token("muted-foreground", "#737373"),
  border: token("border", "#e5e5e5"),
  primary: token("primary", "#171717"),
  primaryForeground: token("primary-foreground", "#fafafa"),
  destructive: token("destructive", "#dc2626"),
  radius: token("radius", "0.625rem"),
} as const

export const pageStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  maxWidth: "28rem",
  minHeight: "100%",
  margin: "0 auto",
  padding: "4rem 1.5rem",
  color: tokens.foreground,
  font: "inherit",
}

export const eyebrowStyle: CSSProperties = {
  margin: "0 0 0.5rem",
  textAlign: "center",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: tokens.mutedForeground,
}

export const headingStyle: CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontSize: "1.5rem",
  fontWeight: 600,
  letterSpacing: "-0.01em",
}

export const leadStyle: CSSProperties = {
  margin: "0.75rem auto 2rem",
  maxWidth: "24rem",
  textAlign: "center",
  fontSize: "0.875rem",
  lineHeight: 1.5,
  color: tokens.mutedForeground,
}

export const cardStyle: CSSProperties = {
  boxSizing: "border-box",
  marginBottom: "1rem",
  padding: "1.25rem",
  border: `1px solid ${tokens.border}`,
  borderRadius: tokens.radius,
  background: tokens.card,
}

export const cardTitleStyle: CSSProperties = {
  margin: "0 0 0.375rem",
  fontSize: "1rem",
  fontWeight: 600,
}

export const cardTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "0.875rem",
  lineHeight: 1.5,
  color: tokens.mutedForeground,
}

export const codeStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.8125rem",
  color: tokens.foreground,
}
