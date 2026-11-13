/**
 * Deprecation warnings: a name on its way out still works, and says so once,
 * in development only (`process.env.NODE_ENV !== "production"`, which Vite
 * and every bundler set). A production build stays silent.
 */

declare const process: { env: { NODE_ENV?: string } }

function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production"
  } catch {
    // No bundler and no `process` (a page loading the SDK as a plain module): stay silent.
    return false
  }
}

const warned = new Set<string>()

/** Warns once per `name` that it is deprecated, and what to use instead. */
export function warnDeprecated(name: string, instead: string): void {
  if (warned.has(name) || !isDevelopment()) return
  warned.add(name)
  console.warn(`[grist-widget-sdk] ${name} is deprecated and goes in 1.0: ${instead}. https://gristwidgets.com/docs/sdk/api/deprecated`)
}

/** @internal Tests: warn again. */
export function resetDeprecationWarnings(): void {
  warned.clear()
}

/** `fn`, warning once (as `name`) when it is first called. */
export function deprecatedFunction<F extends (...args: never[]) => unknown>(name: string, instead: string, fn: F): F {
  return ((...args: Parameters<F>) => {
    warnDeprecated(name, instead)
    return fn(...args)
  }) as F
}
