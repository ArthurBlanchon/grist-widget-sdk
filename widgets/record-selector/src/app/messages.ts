import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    search: "Search",
    searchPlaceholder: "Type to search…",
    results: "Results",
    count: "{n} rows",
    matches: "{n} of {total} rows",
    capped: "Showing the first {shown} of {n} matching rows. Type more to narrow the search.",
    noMatch: "No row matches “{q}”.",
    empty: "No rows yet. Add rows to the table to pick them here.",
    untitled: "Untitled",
  },
  fr: {
    search: "Rechercher",
    searchPlaceholder: "Tapez pour rechercher…",
    results: "Résultats",
    count: "{n} lignes",
    matches: "{n} lignes sur {total}",
    capped: "Les {shown} premières des {n} lignes trouvées sont affichées. Précisez la recherche.",
    noMatch: "Aucune ligne ne correspond à « {q} ».",
    empty: "Aucune ligne pour l'instant. Ajoutez des lignes à la table pour les choisir ici.",
    untitled: "Sans titre",
  },
})
