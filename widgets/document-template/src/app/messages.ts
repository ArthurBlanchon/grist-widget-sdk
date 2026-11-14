import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    title: "Document",
    rowTitle: "Document for row {id}",
    editing: "Editing the template",
    edit: "Edit template",
    print: "Print",
    save: "Save",
    cancel: "Cancel",
    document: "The document",
    templateLabel: "Template (HTML)",
    help: "{{Column}} is the row's cell; {{#rows}} … {{/rows}} repeats for each row. Scripts never run.",
    columns: "Columns: {list}",
    unknown: "No column is called: {list}",
    noRow: "No row is selected. Select one in the table, or add a {{#rows}} section to the template to list them all.",
  },
  fr: {
    title: "Document",
    rowTitle: "Document de la ligne {id}",
    editing: "Modification du modèle",
    edit: "Modifier le modèle",
    print: "Imprimer",
    save: "Enregistrer",
    cancel: "Annuler",
    document: "Le document",
    templateLabel: "Modèle (HTML)",
    help: "{{Colonne}} est la cellule de la ligne ; {{#rows}} … {{/rows}} se répète pour chaque ligne. Les scripts ne s'exécutent jamais.",
    columns: "Colonnes : {list}",
    unknown: "Aucune colonne ne s'appelle : {list}",
    noRow: "Aucune ligne n'est sélectionnée. Choisissez-en une dans la table, ou ajoutez au modèle une section {{#rows}} pour toutes les lister.",
  },
})
