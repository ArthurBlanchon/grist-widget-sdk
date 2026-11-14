import { defineMessages } from "@shared/i18n"

export const messages = defineMessages({
  en: {
    title: "Gantt chart",
    tasks: "Tasks",
    duration: "Duration",
    stats: "{tasks} tasks · {rows} rows · {groups} groups",
    skipped: "{n} rows without dates not shown",
    scale: "Timeline scale",
    monthly: "Months",
    weekly: "Weeks",
    untitled: "Untitled task",
    noGroup: "(no group)",
    noRow: "(no row)",
    empty: "No tasks to show. Add rows with a start and an end date.",
    saveFailed: "Grist did not save the new dates: {error}",
  },
  fr: {
    title: "Diagramme de Gantt",
    tasks: "Tâches",
    duration: "Durée",
    stats: "{tasks} tâches · {rows} lignes · {groups} groupes",
    skipped: "{n} lignes sans dates non affichées",
    scale: "Échelle de la frise",
    monthly: "Mois",
    weekly: "Semaines",
    untitled: "Tâche sans titre",
    noGroup: "(sans groupe)",
    noRow: "(sans ligne)",
    empty: "Aucune tâche à afficher. Ajoutez des lignes avec une date de début et de fin.",
    saveFailed: "Grist n'a pas enregistré les nouvelles dates : {error}",
  },
})
