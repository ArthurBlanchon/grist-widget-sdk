/**
 * The catalog's translations (ADR 0008): every widget ships in English and
 * French. A widget defines its messages once:
 *
 *   export const messages = defineMessages({
 *     en: { empty: "No rows", count: "{n} cards" },
 *     fr: { empty: "Aucune ligne", count: "{n} cartes" },
 *   })
 *
 * and reads them with `const t = useT(messages)`, then `t("count", { n: 3 })`.
 * The French dictionary must have exactly the English keys: a missing or an
 * extra key fails the widget's typecheck.
 */
import { useMemo } from "react"

export type Locale = "en" | "fr"
export const LOCALES: readonly Locale[] = ["en", "fr"]

export type Messages<K extends string> = Readonly<Record<K, string>>

/** Both dictionaries, French typed against the English keys. */
export function defineMessages<K extends string>(messages: {
  en: Messages<K>
  fr: NoInfer<Messages<K>>
}): Readonly<Record<Locale, Messages<K>>> {
  return messages
}

/** The person's language: French when the browser prefers it to English, English otherwise. */
export function detectLocale(languages?: readonly string[]): Locale {
  const list = languages ?? (typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]))
  for (const tag of list) {
    const base = tag.toLowerCase().split("-")[0]
    if (base === "fr" || base === "en") return base
  }
  return "en"
}

/** Replaces `{name}` placeholders with `vars.name`. */
export function format(template: string, vars?: Readonly<Record<string, string | number>>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

/** `t(key, vars?)` for the person's language. */
export function useT<K extends string>(
  messages: Readonly<Record<Locale, Messages<K>>>,
  locale: Locale = detectLocale(),
): (key: K, vars?: Readonly<Record<string, string | number>>) => string {
  return useMemo(() => {
    const dict = messages[locale]
    return (key, vars) => format(dict[key], vars)
  }, [messages, locale])
}
