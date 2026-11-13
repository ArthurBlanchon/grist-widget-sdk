/**
 * Grist stores column widget configuration in `_grist_Tables_column.widgetOptions`
 * as a JSON string. Choice fields use `choices: string[]` plus optional
 * `choiceOptions: Record<string, Style>` (e.g. `fillColor`, `textColor`).
 *
 * @see https://github.com/gristlabs/grist-core/blob/main/app/client/widgets/ChoiceEditor.js
 */

/** One selectable choice for UI (value stored in the cell is `value`). */
export type GristChoiceListEntry = {
  value: string
  label: string
  fillColor?: string
  textColor?: string
}

/**
 * Parse a cell value from `_grist_Tables_column.widgetOptions` into a plain object.
 */
export function parseGristWidgetOptionsCell(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null || raw === "") return undefined
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return undefined
    }
    return undefined
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return undefined
}

function readStyleColor(style: Record<string, unknown>, key: string): string | undefined {
  const v = style[key]
  return typeof v === "string" ? v : undefined
}

/**
 * Normalizes Grist Choice / ChoiceList widgetOptions into a flat list for dropdowns.
 * `choices` entries are string labels (the stored cell value). Per-choice styling
 * lives in `choiceOptions[label]`.
 */
export function normalizeGristChoiceListEntries(
  widgetOptions: Record<string, unknown> | undefined
): GristChoiceListEntry[] {
  if (!widgetOptions) return []
  const rawChoices = widgetOptions.choices
  if (!Array.isArray(rawChoices)) return []

  const choiceOptionsRaw = widgetOptions.choiceOptions
  const choiceOptions: Record<string, Record<string, unknown>> =
    choiceOptionsRaw &&
    typeof choiceOptionsRaw === "object" &&
    !Array.isArray(choiceOptionsRaw)
      ? (choiceOptionsRaw as Record<string, Record<string, unknown>>)
      : {}

  const out: GristChoiceListEntry[] = []
  for (const c of rawChoices) {
    const value = typeof c === "string" ? c : c != null ? String(c) : ""
    if (!value) continue
    const style = choiceOptions[value] ?? {}
    out.push({
      value,
      label: value,
      fillColor: readStyleColor(style, "fillColor"),
      textColor: readStyleColor(style, "textColor"),
    })
  }
  return out
}
