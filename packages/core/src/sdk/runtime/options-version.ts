/**
 * Widget options that evolve (`defineGristWidget({ optionsVersion, migrate })`).
 *
 * Grist keeps a widget's options with its section for years, while the
 * widget changes. The version the widget wrote them under is kept with them,
 * under OPTIONS_VERSION_KEY, which the widget never sees.
 *
 * Reading: options written under an older version reach the widget
 * migrated, every time, in memory. Nothing is written on load: in Grist, a
 * widget's setOptions is a draft of the section (its menu then offers Save
 * and Revert), so writing on load would mark every section modified.
 * Writing: the widget's own writes carry the current version, merged into
 * the migrated options. A write is refused when the options were written by
 * a newer version of the widget, or when they couldn't be migrated: either
 * would label old-shaped data as current, for good.
 *
 * Options without a version count as version 1; an empty section starts at
 * the current version.
 */

/** The options' key the version is kept under. The widget never sees it. */
export const OPTIONS_VERSION_KEY = "__version"

/**
 * Brings options written under `fromVersion` (lower than the widget's
 * `optionsVersion`) to the current version. Return a new object; options it
 * can't migrate: throw, and they are left as they are.
 */
export type MigrateWidgetOptions = (options: Record<string, unknown>, fromVersion: number) => Record<string, unknown>

export type OptionsVersioning = {
  /** The version of the options this widget reads and writes: an integer from 1. */
  optionsVersion?: number
  /** Brings options written under an older version to `optionsVersion`. */
  migrate?: MigrateWidgetOptions
}

/** Refuses an optionsVersion that isn't an integer from 1, and a migrate without one. */
export function checkOptionsVersioning({ optionsVersion, migrate }: OptionsVersioning): void {
  if (optionsVersion !== undefined && !(Number.isInteger(optionsVersion) && optionsVersion >= 1)) {
    throw new Error(`grist-widget-sdk: optionsVersion must be an integer from 1, not ${String(optionsVersion)}`)
  }
  if (migrate !== undefined && typeof migrate !== "function") throw new Error("grist-widget-sdk: migrate must be a function")
  if (migrate && optionsVersion === undefined) throw new Error("grist-widget-sdk: migrate needs the optionsVersion it migrates to")
}

export type ReadOptions = {
  /** What the widget sees. */
  options: Record<string, unknown> | null
  /** The version they were written under (1 without one). */
  from: number
  /** Whether the widget may write over them: false when newer, or not migrated. */
  writable: boolean
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Options as the widget reads them: migrated in memory, the version hidden. */
export function readWidgetOptions(raw: Record<string, unknown> | null, { optionsVersion, migrate }: OptionsVersioning): ReadOptions {
  if (!raw) return { options: raw, from: optionsVersion ?? 1, writable: true }
  const { [OPTIONS_VERSION_KEY]: stored, ...rest } = raw
  const hasVersion = stored !== undefined
  const from = hasVersion
    ? typeof stored === "number" && Number.isInteger(stored) && stored >= 1
      ? stored
      : 1
    : Object.keys(rest).length
      ? 1
      : (optionsVersion ?? 1)
  if (!optionsVersion || from === optionsVersion) return { options: rest, from, writable: true }
  if (from > optionsVersion) return { options: rest, from, writable: false }
  if (!migrate) return { options: rest, from, writable: true }
  try {
    const migrated = migrate({ ...rest }, from)
    if (!isPlainObject(migrated)) throw new Error(`migrate returned ${Array.isArray(migrated) ? "an array" : String(migrated)}, not an object`)
    return { options: migrated, from, writable: true }
  } catch (error) {
    console.warn(`grist-widget-sdk: the widget's options (version ${from}) couldn't be migrated; they are shown as written, and not written over.`, error)
    return { options: rest, from, writable: false }
  }
}

/**
 * Options the widget writes, under the current version; `current` is what
 * Grist holds now. Throws rather than write over options it shouldn't.
 */
export function writeWidgetOptions(
  next: Record<string, unknown>,
  current: Record<string, unknown> | null,
  versioning: OptionsVersioning,
): Record<string, unknown> {
  const { optionsVersion } = versioning
  if (!optionsVersion) return next
  const read = readWidgetOptions(current, versioning)
  if (read.from > optionsVersion) {
    throw new Error(`grist-widget-sdk: these options were written by a newer version of the widget (${read.from}, this is ${optionsVersion}); not written over`)
  }
  if (!read.writable) throw new Error("grist-widget-sdk: these options couldn't be migrated; not written over")
  return { ...next, [OPTIONS_VERSION_KEY]: optionsVersion }
}
