import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    title: "Map",
    points: "{n} points",
    skipped: "{n} rows without valid coordinates not shown",
    countries: "{n} countries · {total} in all",
    value: "Value: {value}",
    count: "Rows: {value}",
    legend: "Legend",
    noCategory: "(no category)",
    other: "Others ({n} points)",
    howTo: "Map a Latitude and a Longitude column to place points, or a Country column (ISO codes) to colour countries.",
    low: "Low",
    high: "High",
  },
  fr: {
    title: "Carte",
    points: "{n} points",
    skipped: "{n} lignes sans coordonnées valides non affichées",
    countries: "{n} pays · {total} au total",
    value: "Valeur : {value}",
    count: "Lignes : {value}",
    legend: "Légende",
    noCategory: "(sans catégorie)",
    other: "Autres ({n} points)",
    howTo: "Associez une colonne Latitude et une colonne Longitude pour placer des points, ou une colonne Pays (codes ISO) pour colorer les pays.",
    low: "Faible",
    high: "Élevé",
  },
})
