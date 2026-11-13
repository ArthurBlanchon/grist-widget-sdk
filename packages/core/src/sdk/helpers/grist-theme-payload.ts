export type GristThemeName = "light" | "dark"

/**
 * Normalize theme from `grist.on("message")` host payloads (`msg.theme`).
 * Grist sends a theme object with `appearance`; some hosts may send a bare string.
 */
export function parseGristThemePayload(payload: unknown): GristThemeName | null {
  if (!payload || typeof payload !== "object") return null
  const raw = payload as Record<string, unknown>
  const top = raw.theme
  if (top === "light" || top === "dark") return top
  if (top && typeof top === "object") {
    const appearance = (top as Record<string, unknown>).appearance
    if (appearance === "light" || appearance === "dark") return appearance
  }
  return null
}
