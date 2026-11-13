import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

import { useNearestGristState } from "../sdk/use-grist"

export type WidgetTheme = "light" | "dark" | "system"
export type ResolvedWidgetTheme = "light" | "dark"

export type UseThemeResult = {
  /**
   * Inside Grist: Grist's theme, or `"system"` until Grist has sent it.
   * Outside Grist: the saved choice, `"system"` by default.
   */
  theme: WidgetTheme
  /** The theme applied to `<html class>`: `"system"` resolved to light or dark. */
  resolvedTheme: ResolvedWidgetTheme
  /**
   * Choose a theme outside Grist; it is saved in `localStorage`. Inside Grist
   * this does nothing: the widget follows Grist's theme.
   */
  setTheme: (theme: WidgetTheme) => void
}

const STORAGE_KEY = "theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"
const THEMES: readonly WidgetTheme[] = ["light", "dark", "system"]

const ThemeContext = createContext<UseThemeResult | null>(null)

/**
 * The widget's current theme, for components that need it in JavaScript
 * (a toaster, a chart). Same shape as shadcn's `useTheme()`. Styles should
 * rely on the `dark` class that {@link mountGristWidget} keeps on `<html>`.
 * Outside a mounted widget (a unit test, for instance) it reports the
 * system theme and `setTheme` does nothing.
 */
export function useTheme(): UseThemeResult {
  const value = useContext(ThemeContext)
  return value ?? { theme: "system", resolvedTheme: systemTheme(), setTheme: noop }
}

/** Inside Grist: follows Grist's theme, and the OS setting until Grist sends one. */
export function EmbeddedThemeProvider({ children }: { children: ReactNode }) {
  const gristTheme = useNearestGristState().state.theme
  const system = useSystemTheme(gristTheme === null)
  const resolvedTheme = gristTheme ?? system

  useApplyTheme(resolvedTheme)

  const value = useMemo<UseThemeResult>(
    () => ({ theme: gristTheme ?? "system", resolvedTheme, setTheme: noop }),
    [gristTheme, resolvedTheme]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Outside Grist (`pnpm dev`, the deployed release page): the saved choice,
 * the OS setting by default, and the `d` key to switch between light and
 * dark, as shadcn's theme provider does.
 */
export function StandaloneThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WidgetTheme>(() => readStoredTheme() ?? "system")
  const system = useSystemTheme(theme === "system")
  const resolvedTheme = theme === "system" ? system : theme

  useApplyTheme(resolvedTheme)

  const setTheme = useCallback((next: WidgetTheme) => {
    writeStoredTheme(next)
    setThemeState(next)
  }, [])

  // `d` switches between light and dark, unless typing or using a shortcut.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() !== "d" || isEditableTarget(event.target)) return
      setThemeState((current) => {
        const currentResolved = current === "system" ? systemTheme() : current
        const next: WidgetTheme = currentResolved === "dark" ? "light" : "dark"
        writeStoredTheme(next)
        return next
      })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Another tab saving a choice applies here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      setThemeState(isTheme(event.newValue) ? event.newValue : "system")
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const value = useMemo<UseThemeResult>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** The OS setting, kept current while `active`. */
function useSystemTheme(active: boolean): ResolvedWidgetTheme {
  const [theme, setTheme] = useState<ResolvedWidgetTheme>(systemTheme)

  useEffect(() => {
    if (!active || typeof window.matchMedia !== "function") return
    const query = window.matchMedia(DARK_QUERY)
    const onChange = () => setTheme(query.matches ? "dark" : "light")
    onChange()
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [active])

  return theme
}

/** Keep `light` or `dark` on `<html class>`, which Tailwind's dark variant reads. */
function useApplyTheme(theme: ResolvedWidgetTheme) {
  useEffect(() => {
    const root = document.documentElement
    if (root.classList.contains(theme) && !root.classList.contains(other(theme))) return
    const restoreTransitions = suspendTransitions()
    root.classList.remove(other(theme))
    root.classList.add(theme)
    restoreTransitions()
  }, [theme])
}

function systemTheme(): ResolvedWidgetTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light"
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light"
}

function other(theme: ResolvedWidgetTheme): ResolvedWidgetTheme {
  return theme === "dark" ? "light" : "dark"
}

/** Switch themes without every color transition animating at once. */
function suspendTransitions(): () => void {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode("*,*::before,*::after{-webkit-transition:none!important;transition:none!important}")
  )
  document.head.appendChild(style)
  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => requestAnimationFrame(() => style.remove()))
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null
}

function isTheme(value: string | null): value is WidgetTheme {
  return value !== null && (THEMES as readonly string[]).includes(value)
}

function readStoredTheme(): WidgetTheme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

function writeStoredTheme(theme: WidgetTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked (private mode, sandboxed iframe): the choice lasts for this page only.
  }
}

function noop() {}
