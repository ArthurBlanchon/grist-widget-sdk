/**
 * Widget options that evolve (`defineGristWidget({ optionsVersion, migrate })`).
 * ADR 0017.
 *
 * Grist keeps a widget's options with its section for years, while the
 * widget changes. A widget that declares `optionsVersion` keeps the version
 * it wrote them under with them, under OPTIONS_VERSION_KEY, which it never
 * sees. A widget that declares none reads and writes its options untouched.
 *
 * Reading: options written under an older version reach the widget
 * migrated, every time, in memory. Nothing is written on load: in Grist, a
 * widget's setOptions is a draft of the section (its menu then offers Save
 * and Revert), so writing on load would mark every section modified.
 * Writing: the widget's writes carry the current version; a patch merges
 * into the migrated options. A write is refused when the options were
 * written by a newer version, or couldn't be migrated, or carry a version
 * the SDK can't read: either would label other-shaped data as current, for
 * good. `optionsIssue` says so, and `setWidgetOptions({})` always resets.
 *
 * Options without a version count as version 1; an empty section starts at
 * the current version.
 */

/** The options' key the version is kept under: reserved. The widget never sees it. */
export const OPTIONS_VERSION_KEY = "__version"

/**
 * Brings options written under `fromVersion` (lower than the widget's
 * `optionsVersion`) to the current version. Return a new plain object; options
 * it can't migrate: throw, and they are left as they are. Check the options'
 * shape rather than trust `fromVersion` alone: options without a version
 * count as version 1, and may already be in a later shape.
 */
export type MigrateWidgetOptions = (options: Record<string, unknown>, fromVersion: number) => Record<string, unknown>

export type OptionsVersioning = {
  /** The version of the options this widget reads and writes: an integer from 1. */
  optionsVersion?: number
  /** Brings options written under an older version to `optionsVersion`: required from version 2. */
  migrate?: MigrateWidgetOptions
}

/** Refuses an optionsVersion that isn't an integer from 1, a migrate without one, and a version above 1 without migrate. */
export function checkOptionsVersioning({ optionsVersion, migrate }: OptionsVersioning): void {
  if (optionsVersion !== undefined && !(Number.isInteger(optionsVersion) && optionsVersion >= 1)) {
    throw new Error(`grist-widget-sdk: optionsVersion must be an integer from 1, not ${String(optionsVersion)}`)
  }
  if (migrate !== undefined && typeof migrate !== "function") throw new Error("grist-widget-sdk: migrate must be a function")
  if (migrate && optionsVersion === undefined) throw new Error("grist-widget-sdk: migrate needs the optionsVersion it migrates to")
  if (optionsVersion !== undefined && optionsVersion > 1 && !migrate) {
    throw new Error(`grist-widget-sdk: optionsVersion ${optionsVersion} needs migrate, to read the options earlier versions wrote`)
  }
}

export type ReadOptions = {
  /** What the widget sees. */
  options: Record<string, unknown> | null
  /** Why the widget may not write over them, or null. */
  issue: string | null
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

const warned = new Set<string>()
function warnOnce(message: string, error: unknown) {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(`grist-widget-sdk: ${message}`, error)
}

/** Options as the widget reads them: migrated in memory, the version hidden. */
export function readWidgetOptions(raw: Record<string, unknown> | null, { optionsVersion, migrate }: OptionsVersioning): ReadOptions {
  if (!raw || !optionsVersion) return { options: raw, issue: null }
  const { [OPTIONS_VERSION_KEY]: stored, ...rest } = raw
  let from: number
  if (stored === undefined) from = Object.keys(rest).length ? 1 : optionsVersion
  else if (typeof stored === "number" && Number.isInteger(stored) && stored >= 1) from = stored
  else return { options: rest, issue: `the options carry a version this widget can't read (${JSON.stringify(stored)}); reset them to write` }
  if (from === optionsVersion) return { options: rest, issue: null }
  if (from > optionsVersion) {
    return { options: rest, issue: `the options were written by a newer version of this widget (${from}, this is ${optionsVersion}); reset them to write` }
  }
  try {
    // A deep copy: a migrate that changes nested values changes only its copy.
    const migrated = migrate ? migrate(structuredClone(rest), from) : rest
    if (!isPlainObject(migrated)) throw new Error(`migrate returned ${Array.isArray(migrated) ? "an array" : String(migrated)}, not a plain object`)
    return { options: migrated, issue: null }
  } catch (error) {
    const message = `the widget's options (version ${from}) couldn't be migrated: ${String((error as Error)?.message ?? error)}`
    warnOnce(message, error)
    return { options: rest, issue: `${message}; reset them to write` }
  }
}

/**
 * The options a write stores: `next` (the whole options, as the widget reads
 * them), under the current version. `read` is how the widget reads what
 * Grist holds now. Throws rather than write over options it shouldn't; an
 * empty object always goes through: it resets them.
 */
export function writeWidgetOptions(next: Record<string, unknown>, read: ReadOptions, { optionsVersion }: OptionsVersioning): Record<string, unknown> {
  if (!optionsVersion) return next
  if (read.issue && Object.keys(next).length > 0) throw new Error(`grist-widget-sdk: ${read.issue}`)
  return { ...next, [OPTIONS_VERSION_KEY]: optionsVersion }
}
