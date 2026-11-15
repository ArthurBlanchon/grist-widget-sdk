import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    howTo: "Map a column holding Mermaid code (cell mode), or a From and a To column to draw a flowchart from the rows.",
    noRow: "No row is selected. Select one to see its diagram.",
    emptyCell: "This row's cell is empty: write a Mermaid diagram in it.",
    noRows: "No row has a From value yet.",
    fromCell: "The selected row's diagram",
    fromRows: "A flowchart of the rows: an arrow from From to To per row",
    download: "Download SVG",
    syntax: "Mermaid can't draw this: {error}",
    diagram: "The diagram",
  },
  fr: {
    howTo: "Associez une colonne contenant du code Mermaid (mode cellule), ou une colonne De et une colonne Vers pour tracer un organigramme à partir des lignes.",
    noRow: "Aucune ligne n'est sélectionnée. Choisissez-en une pour voir son diagramme.",
    emptyCell: "La cellule de cette ligne est vide : écrivez-y un diagramme Mermaid.",
    noRows: "Aucune ligne n'a encore de valeur De.",
    fromCell: "Le diagramme de la ligne sélectionnée",
    fromRows: "Un organigramme des lignes : une flèche de De vers Vers par ligne",
    download: "Télécharger le SVG",
    syntax: "Mermaid ne peut pas dessiner ceci : {error}",
    diagram: "Le diagramme",
  },
})
