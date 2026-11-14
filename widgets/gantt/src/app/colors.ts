import { normalizeGristChoiceListEntries } from "grist-widget-sdk"

/**
 * Bar and group colours. A Choice column's own colours (set in Grist) are
 * data and are used as they are; everything else is a theme token, so the
 * Gantt follows the shared theme, light and dark.
 */

export type ChoiceStyle = { fillColor?: string; textColor?: string }

const GROUP_TOKENS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"] as const
export const DEFAULT_BAR = { fillColor: "var(--primary)", textColor: "var(--primary-foreground)" }

/** Each choice's colours, from the column's settings in Grist. */
export function choiceStyles(widgetOptions: Record<string, unknown> | undefined): Map<string, ChoiceStyle> {
  const map = new Map<string, ChoiceStyle>()
  for (const entry of normalizeGristChoiceListEntries(widgetOptions)) {
    map.set(entry.value, { fillColor: cssColor(entry.fillColor) ?? undefined, textColor: cssColor(entry.textColor) ?? undefined })
  }
  return map
}

/** A colour Grist stores (`#RRGGBB`), accepted only in a form CSS reads safely. */
export function cssColor(value: unknown): string | null {
  if (typeof value !== "string") return null
  const v = value.trim()
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : null
}

export const groupColor = (choice: ChoiceStyle | undefined, index: number) =>
  choice?.fillColor ?? GROUP_TOKENS[index % GROUP_TOKENS.length]!

/** A bar's colours: its status choice's, or the theme's. */
export function barStyle(choice: ChoiceStyle | undefined): { fillColor: string; textColor: string } {
  if (!choice?.fillColor) return DEFAULT_BAR
  return { fillColor: choice.fillColor, textColor: choice.textColor ?? readableOn(choice.fillColor) }
}

/** Black or white, whichever reads on `hex`. */
export function readableOn(hex: string): string {
  const h = hex.slice(1)
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16))
  const luminance = (0.299 * r! + 0.587 * g! + 0.114 * b!) / 255
  return luminance > 0.62 ? "black" : "white"
}
