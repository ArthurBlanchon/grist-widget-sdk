/** Grist dates as the Gantt's calendar days, and back. */

/** A Date column's day (UTC midnight in Grist), as local midnight: the day the person sees. */
const utcDayToLocal = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

/** A cell (a Date, seconds since the epoch, or a date string) as a local calendar day, or null. */
export function calendarDay(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null
  let d: Date | null = null
  if (value instanceof Date) d = value
  else if (typeof value === "number" && Number.isFinite(value)) d = new Date(value < 1e12 ? value * 1000 : value)
  else if (typeof value === "string") {
    const t = Date.parse(value)
    d = Number.isNaN(t) ? null : new Date(t)
  }
  return d && !Number.isNaN(d.getTime()) ? utcDayToLocal(d) : null
}

/** A local calendar day as Grist's Date value: that day at UTC midnight. */
export const toGristDay = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
