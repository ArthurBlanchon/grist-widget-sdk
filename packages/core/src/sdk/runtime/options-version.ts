/**
 * Widget options that evolve (`defineGristWidget({ optionsVersion, migrate })`).
 *
 * Grist keeps a widget's options in the document for years, while the widget
 * changes. The version they were saved under is kept with them, under
 * OPTIONS_VERSION_KEY. When the widget reads options saved under an older
 * version, `migrate` brings them to the current one: the widget sees the
 * migrated options, and the SDK saves them back (when the person may; a
 * viewer's copy is migrated again on each load). Options saved before the
 * widget declared a version count as version 1; an empty section starts at
 * the current version. Options saved by a newer version of the widget are
 * left as they are.
 */

/** The options' key the version is kept under. The widget never sees it. */
export const OPTIONS_VERSION_KEY = "__version"

export type MigrateWidgetOptions = (options: Record<string, unknown>, fromVersion: number) => Record<string, unknown>

export type OptionsVersioning = {
  /** The version of the options this widget reads and writes: an integer from 1. */
  optionsVersion?: number
  /** Brings options saved under `fromVersion` (lower than `optionsVersion`) to the current version. */
  migrate?: MigrateWidgetOptions
}

/** What the widget sees, and what to save back (null: nothing). */
export function migrateWidgetOptions(
  raw: Record<string, unknown> | null,
  { optionsVersion, migrate }: OptionsVersioning,
): { options: Record<string, unknown> | null; save: Record<string, unknown> | null } {
  if (!raw || !optionsVersion) return { options: raw, save: null }
  const { [OPTIONS_VERSION_KEY]: stored, ...rest } = raw
  const from = typeof stored === "number" && Number.isInteger(stored) ? stored : Object.keys(rest).length ? 1 : optionsVersion
  if (from >= optionsVersion) return { options: rest, save: null }
  let migrated: Record<string, unknown>
  try {
    migrated = migrate ? migrate(rest, from) : rest
  } catch (error) {
    console.warn(`grist-widget-sdk: migrating the widget's options from version ${from} failed; they are left as saved.`, error)
    return { options: rest, save: null }
  }
  return { options: migrated, save: { ...migrated, [OPTIONS_VERSION_KEY]: optionsVersion } }
}

/** Options the widget writes, with the version they are written under. */
export function withOptionsVersion(options: Record<string, unknown>, { optionsVersion }: OptionsVersioning): Record<string, unknown> {
  return optionsVersion ? { ...options, [OPTIONS_VERSION_KEY]: optionsVersion } : options
}
