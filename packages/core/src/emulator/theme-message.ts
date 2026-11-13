export type GristThemeAppearance = "light" | "dark"

/** Host → widget postMessage shape used by `grist-plugin-api.js` (`onThemeChange`). */
export type GristThemeHostMessage = {
  theme: {
    appearance: GristThemeAppearance
    name: string
    colors: Record<string, string>
  }
  fromReady?: boolean
}

export function buildGristThemeHostMessage(
  appearance: GristThemeAppearance,
  options?: { fromReady?: boolean }
): GristThemeHostMessage {
  return {
    theme: {
      appearance,
      name: appearance,
      colors: {},
    },
    ...(options?.fromReady ? { fromReady: true } : {}),
  }
}
