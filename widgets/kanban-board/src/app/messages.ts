import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    title: "Board",
    cardCount: "{n} cards",
    empty: "No rows yet. Add rows to the table and they appear here, grouped by status.",
    noStatus: "No status",
    noCards: "No cards",
    addColumn: "Add column",
    newColumn: "New column name",
    moveColumnLeft: "Move column {name} left",
    moveColumnRight: "Move column {name} right",
    card: "{title}, in {status}",
    cardHint: "Press the left or right arrow key to move the card to the next column.",
    untitled: "Untitled",
    saveFailed: "The change could not be saved: {error}",
  },
  fr: {
    title: "Tableau",
    cardCount: "{n} cartes",
    empty: "Aucune ligne pour l'instant. Ajoutez des lignes à la table : elles apparaissent ici, groupées par statut.",
    noStatus: "Sans statut",
    noCards: "Aucune carte",
    addColumn: "Ajouter une colonne",
    newColumn: "Nom de la nouvelle colonne",
    moveColumnLeft: "Déplacer la colonne {name} vers la gauche",
    moveColumnRight: "Déplacer la colonne {name} vers la droite",
    card: "{title}, dans {status}",
    cardHint: "Appuyez sur la flèche gauche ou droite pour déplacer la carte dans la colonne voisine.",
    untitled: "Sans titre",
    saveFailed: "La modification n'a pas pu être enregistrée : {error}",
  },
})
