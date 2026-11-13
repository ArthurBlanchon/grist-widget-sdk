/**
 * Browser APIs jsdom lacks but widget UI commonly uses, as inert stand-ins:
 * `ResizeObserver` (charts, virtualized lists, popovers) and
 * `window.matchMedia` (the theme, responsive hooks; it reports a light,
 * wide screen). Only installs what's missing, so a test's own mock wins.
 *
 * {@link smokeTestWidget} calls it. For a widget's other tests, call it at
 * the top of the test file or in a Vitest setup file.
 */
export function installJsdomStubs(): void {
  if (typeof window === "undefined") return

  globalThis.ResizeObserver ??= class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
