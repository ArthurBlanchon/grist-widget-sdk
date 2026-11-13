/**
 * Single-call wrapper around `grist.ready()`.
 *
 * Grist's contract is "call ready once". Multiple `useGristReady` calls (or
 * `useGristWidget` from sibling components) would otherwise race. We:
 *
 * - Coalesce concurrent calls into one in-flight promise.
 * - Re-call `grist.ready` only when `requiredAccess` widens (so an action-capable
 *   hook can upgrade a previously read-only handshake).
 */

import type { GristColumnsToMap, GristReadyOptions, GristRequiredAccess } from "../types"

const ACCESS_RANK: Record<GristRequiredAccess, number> = {
  none: 0,
  "read table": 1,
  full: 2,
}

let inFlight: Promise<void> | null = null
let lastAccess: GristRequiredAccess | null = null
let lastColumnNames: ReadonlySet<string> | null = null

function columnNamesOf(columns: GristColumnsToMap | undefined): Set<string> {
  return new Set((columns ?? []).map((c) => (typeof c === "string" ? c : c.name)))
}

/**
 * Re-init whenever the new payload asks for strictly more than what's
 * already cached: a higher access level, or a column name the cached
 * payload didn't declare. Prevents a bare fallback caller (e.g. a status
 * chip with no declared columns) from permanently sticking a widget's real,
 * richer requirements to the host once it happens to win the initial race.
 */
function shouldReinit(next: GristRequiredAccess, nextColumns: ReadonlySet<string>): boolean {
  if (!lastAccess) return true
  if (ACCESS_RANK[next] > ACCESS_RANK[lastAccess]) return true
  for (const name of nextColumns) {
    if (!lastColumnNames?.has(name)) return true
  }
  return false
}

/**
 * Calls `grist.ready` at most once per page (re-called only if access widens
 * or previously-undeclared columns are requested).
 * Returns the same promise for all concurrent callers.
 */
export function ensureGristReady(payload: GristReadyOptions): Promise<void> {
  const access = payload.requiredAccess ?? "read table"
  const columns = columnNamesOf(payload.columns)
  if (inFlight && !shouldReinit(access, columns)) return inFlight

  lastAccess = access
  lastColumnNames = columns
  const next = Promise.resolve().then(() => {
    const result = grist.ready(payload)
    return result instanceof Promise ? result : Promise.resolve()
  })

  inFlight = next.catch((err) => {
    inFlight = null
    lastAccess = null
    lastColumnNames = null
    throw err
  })
  return inFlight
}

/**
 * Forget the cached ready state. Subsequent calls to {@link ensureGristReady}
 * will re-issue `grist.ready` even at the same access level.
 *
 * Production uses: the handshake manager's `reload()` clears the singleton so
 * a soft retry triggers a fresh `grist.ready` (otherwise the cached promise
 * would short-circuit and the user-visible reload would be a no-op).
 *
 * Tests use this between test cases when swapping `window.grist`.
 */
export function resetGristReady(): void {
  inFlight = null
  lastAccess = null
  lastColumnNames = null
}

/** @deprecated Use {@link resetGristReadySingleton}. Kept for test back-compat. */
