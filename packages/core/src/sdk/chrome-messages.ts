/**
 * The words of the SDK's own chrome (GristBoundary's screens, the alerts, the
 * "Report a problem" link, the crash screen), in each language the SDK
 * speaks. A widget says which languages it ships in its declaration
 * (`languages`); the chrome speaks the first of the person's browser
 * languages that both the widget and the SDK have, so it matches the widget.
 * `mountGristWidget()` (and `GristWidgetApp`) set it; a `GristBoundary`
 * rendered under a provider of the widget's own speaks English.
 *
 * The French quotes Grist's own French labels ("Accès complet au document",
 * "vue personnalisée"), as Grist's French interface shows them.
 */

import { createContext, createElement, useContext, useMemo, type ReactNode } from "react"

import type { GristRequiredAccess } from "./types"

/** The languages the SDK's chrome speaks. */
export const CHROME_LOCALES = ["en", "fr"] as const
export type GristChromeLocale = (typeof CHROME_LOCALES)[number]

const en = {
  connectingTitle: "Connecting to Grist",
  connectingMessage: "Asking Grist for the access this widget needs…",
  openInGristTitle: "Open inside Grist",
  notEmbeddedMessage: "Open this page as a custom widget inside a Grist document (it runs in an embedded panel, not on its own).",
  unavailableMessage: "The Grist plugin did not load. Reload the page, or open this URL as a custom widget inside a Grist document.",
  errorTitle: "Something went wrong",
  errorMessage: "Something went wrong connecting to Grist. Try again, or reload the page.",
  accessTitle: "More access needed",
  accessMessage: 'Set Access level to at least "{level}" in the Custom widget settings.',
  mappingPendingMessage: "Waiting for Grist to report the column mapping…",
  mappingTitle: "Map your columns",
  mappingMessage: "Open the widget settings in Grist (Creator Panel → Custom widget) and connect each required column to your table.",
  retry: "Try again",
  retrying: "Retrying…",
  reconnect: "Try reconnecting",
  reconnecting: "Reconnecting…",
  accessFull: "Full document access",
  accessRead: "Read selected table",
  accessNone: "No document access",

  alertColumnMapping: "Column mapping",
  alertLinking: "Widget linking",
  alertActionError: "Action error",
  alertAccess: "Access level",
  alertMapBackSkip: "Write skipped",
  alertCellIssues: "Unexpected values",
  alertReadOnly: "Read-only document",
  mappingPendingAlert: "Waiting for Grist to report column mappings.",
  mappingIncomplete: "Column mapping is incomplete.",
  mappingRequired: "Required columns: {columns}.",
  mappingEmptyMultiples: "Assign at least one sheet column for: {columns}.",
  readOnlyAlert: "This document is open read-only: the widget shows its data, but can't change it.",
  accessInsufficientAlert:
    'This operation requires "Full document access". Set the Access level to "Full document access" in the Custom widget configuration panel.',
  mapBackSkipOne: "mapBack skipped multi-mapped column: {columns}.",
  mapBackSkipMany: "mapBack skipped multi-mapped columns: {columns}.",
  cellIssueColumn: "{column} in row {row}",
  cellIssueRow: "row {row}",
  cellIssueMore: " (and {n} more)",
  cellIssues: "{where}: {message}{more}. Check the column's type, or the cell, in Grist.",
  sourceNotWired:
    "No section follows this widget yet, and it works by driving another one. In Grist, open that section's creator panel, Data, and set SELECT BY to this widget.",
  sectionNotLinked:
    "This widget shows the row selected in another section, and this section follows none.",
  sectionNotLinkedHint:
    "In Grist, open this widget's creator panel, Data, and set SELECT BY to a table or card on the page.",

  reportProblem: "Report a problem",
  crashTitle: "The widget stopped working",
  crashMessage: "Reload it to try again. If it happens again, report the problem: say what you did just before.",
  crashReload: "Reload the widget",
}

export type GristChromeMessages = Readonly<Record<keyof typeof en, string>>

const fr: GristChromeMessages = {
  connectingTitle: "Connexion à Grist",
  connectingMessage: "Le widget demande à Grist l'accès dont il a besoin…",
  openInGristTitle: "Ouvrir dans Grist",
  notEmbeddedMessage:
    "Ouvrez cette page comme vue personnalisée dans un document Grist (elle s'affiche dans un panneau du document, pas seule).",
  unavailableMessage:
    "Le module de Grist ne s'est pas chargé. Rechargez la page, ou ouvrez cette URL comme vue personnalisée dans un document Grist.",
  errorTitle: "Une erreur s'est produite",
  errorMessage: "La connexion à Grist a échoué. Réessayez, ou rechargez la page.",
  accessTitle: "Il faut plus d'accès",
  accessMessage: "Choisissez au moins « {level} » comme niveau d'accès, dans les réglages de la vue personnalisée.",
  mappingPendingMessage: "En attente des colonnes associées, que Grist envoie…",
  mappingTitle: "Associez vos colonnes",
  mappingMessage:
    "Ouvrez les réglages du widget dans Grist (panneau de création → vue personnalisée) et associez chaque colonne requise à une colonne de votre table.",
  retry: "Réessayer",
  retrying: "Nouvel essai…",
  reconnect: "Se reconnecter",
  reconnecting: "Reconnexion…",
  accessFull: "Accès complet au document",
  accessRead: "Lire les données source sélectionnées",
  accessNone: "Pas d’accès au document",

  alertColumnMapping: "Colonnes associées",
  alertLinking: "Liaison du widget",
  alertActionError: "Échec d'une modification",
  alertAccess: "Niveau d'accès",
  alertMapBackSkip: "Écriture ignorée",
  alertCellIssues: "Valeurs inattendues",
  alertReadOnly: "Document en lecture seule",
  mappingPendingAlert: "En attente des colonnes associées, que Grist envoie.",
  mappingIncomplete: "Des colonnes ne sont pas associées.",
  mappingRequired: "Colonnes requises : {columns}.",
  mappingEmptyMultiples: "Associez au moins une colonne de la table à : {columns}.",
  readOnlyAlert: "Ce document est ouvert en lecture seule : le widget montre ses données, mais ne peut pas les modifier.",
  accessInsufficientAlert:
    "Cette opération demande « Accès complet au document ». Choisissez « Accès complet au document » comme niveau d'accès, dans les réglages de la vue personnalisée.",
  mapBackSkipOne: "mapBack a ignoré une colonne associée plusieurs fois : {columns}.",
  mapBackSkipMany: "mapBack a ignoré des colonnes associées plusieurs fois : {columns}.",
  cellIssueColumn: "{column}, ligne {row}",
  cellIssueRow: "ligne {row}",
  cellIssueMore: " (et {n} de plus)",
  cellIssues: "{where} : {message}{more}. Vérifiez le type de la colonne, ou la cellule, dans Grist.",
  sourceNotWired:
    "Aucune section ne suit encore ce widget, qui sert à en piloter une autre. Dans Grist, ouvrez le panneau de cette section, Données, et choisissez ce widget sous SÉLECTIONNER PAR.",
  sectionNotLinked:
    "Ce widget montre la ligne sélectionnée dans une autre section, et cette section n'en suit aucune.",
  sectionNotLinkedHint:
    "Dans Grist, ouvrez le panneau de ce widget, Données, et choisissez sous SÉLECTIONNER PAR une table ou une fiche de la page.",

  reportProblem: "Signaler un problème",
  crashTitle: "Le widget ne fonctionne plus",
  crashMessage: "Rechargez-le pour réessayer. Si cela se reproduit, signalez le problème : dites ce que vous veniez de faire.",
  crashReload: "Recharger le widget",
}

/** Each language's chrome. */
export const CHROME_MESSAGES: Readonly<Record<GristChromeLocale, GristChromeMessages>> = { en, fr }

/**
 * The chrome's language: the first of the person's languages (the
 * browser's, by default) that the widget ships and the SDK speaks; else the
 * widget's first language the SDK speaks; else English.
 */
export function chromeLocale(
  widgetLanguages: readonly string[] | undefined,
  browserLanguages: readonly string[] = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language])
): GristChromeLocale {
  // A declaration from untyped code may hold anything: keep the strings, never throw above the crash screen.
  const tags = (list: unknown): string[] => (Array.isArray(list) ? list.filter((t): t is string => typeof t === "string") : [])
  const base = (tag: string) => tag.toLowerCase().split(/[-_]/)[0]!
  const spoken = (tag: string): tag is GristChromeLocale => (CHROME_LOCALES as readonly string[]).includes(tag)
  const declared = tags(widgetLanguages)
  const widget = (declared.length ? declared : ["en"]).map(base)
  for (const tag of tags(browserLanguages).map(base)) if (widget.includes(tag) && spoken(tag)) return tag
  return widget.find(spoken) ?? "en"
}

/** Replaces `{name}` with `vars.name`. */
export function formatChrome(template: string, vars?: Readonly<Record<string, string | number>>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

/** The label Grist's custom-widget panel gives an access level, in `locale`. */
export function chromeAccessLabel(level: GristRequiredAccess, locale: GristChromeLocale = "en"): string {
  const t = CHROME_MESSAGES[locale]
  return level === "full" ? t.accessFull : level === "read table" ? t.accessRead : t.accessNone
}

const ChromeLocaleContext = createContext<GristChromeLocale>("en")

/** @internal The chrome's language for what renders below; `mountGristWidget()` sets it from the declaration. */
export function GristChromeLocaleProvider({ languages, children }: { languages?: readonly string[]; children: ReactNode }) {
  const locale = useMemo(() => chromeLocale(languages), [languages])
  return createElement(ChromeLocaleContext.Provider, { value: locale }, children)
}

/** @internal The chrome's language and words, for the SDK's own components. */
export function useChromeMessages(): { locale: GristChromeLocale; t: GristChromeMessages } {
  const locale = useContext(ChromeLocaleContext)
  return { locale, t: CHROME_MESSAGES[locale] }
}
