import type { GristWidgetInteraction, GristWidgetLinkingInfo } from "../types"

/**
 * Parse `InteractionOptions.linking` from a Grist `onOptions` settings payload.
 */
export function parseGristWidgetLinkingInfo(raw: unknown): GristWidgetLinkingInfo | undefined {
  if (!raw || typeof raw !== "object" || !("asTarget" in raw)) return undefined
  const linking = raw as { asTarget: unknown; asSource?: unknown }
  return {
    asTarget: linking.asTarget == null ? null : String(linking.asTarget),
    asSource: Boolean(linking.asSource),
  }
}

/**
 * Normalize the second argument to `grist.onOptions` (Grist `InteractionOptions`).
 * Hosts use `accessLevel` (camelCase); the emulator uses `access_level`.
 */
export function normalizeWidgetInteraction(
  interaction: GristWidgetInteraction | null
): GristWidgetInteraction | null {
  if (!interaction || typeof interaction !== "object") return interaction
  const raw = interaction as Record<string, unknown>
  const access_level =
    typeof raw.access_level === "string"
      ? raw.access_level
      : typeof raw.accessLevel === "string"
        ? raw.accessLevel
        : undefined
  const linking = parseGristWidgetLinkingInfo(raw.linking)
  return {
    ...interaction,
    ...(access_level ? { access_level } : {}),
    ...(linking ? { linking } : {}),
  }
}
