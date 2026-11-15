import type { GristWidgetDemo } from "grist-widget-sdk"

// Title, group, team, start, days, status.
const TASKS: [string, string, string, string, number, string][] = [
  ["Survey the house", "Design", "Architects", "2026-11-02", 5, "Done"],
  ["Draw the plans", "Design", "Architects", "2026-11-09", 12, "Done"],
  ["Choose the materials", "Design", "Interior", "2026-11-16", 8, "Done"],
  ["Kitchen layout", "Design", "Interior", "2026-11-23", 6, "In progress"],
  ["Lighting plan", "Design", "Electricians", "2026-11-25", 5, "In progress"],
  ["Building permit", "Permits", "Architects", "2026-11-23", 25, "In progress"],
  ["Asbestos survey", "Permits", "Builders", "2026-11-30", 4, "Late"],
  ["Road closure for the skip", "Permits", "Builders", "2026-12-14", 3, "Planned"],
  ["Strip out", "Works", "Builders", "2026-12-21", 7, "Planned"],
  ["Structural walls", "Works", "Builders", "2027-01-04", 10, "Planned"],
  ["Rewiring", "Works", "Electricians", "2027-01-11", 9, "Planned"],
  ["Plumbing", "Works", "Plumbers", "2027-01-11", 8, "Planned"],
  ["Underfloor heating", "Works", "Plumbers", "2027-01-25", 5, "Planned"],
  ["Plastering", "Works", "Builders", "2027-01-25", 8, "Planned"],
  ["Kitchen fitting", "Works", "Interior", "2027-02-08", 6, "Planned"],
  ["Painting", "Works", "Interior", "2027-02-15", 7, "Planned"],
  ["Final electrics", "Works", "Electricians", "2027-02-15", 3, "Planned"],
  ["Snagging list", "Handover", "Architects", "2027-02-24", 3, "Planned"],
  ["Safety certificates", "Handover", "Electricians", "2027-02-26", 2, "Planned"],
  ["Keys to the owners", "Handover", "Architects", "2027-03-01", 1, "Planned"],
]

const plusDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** A house renovation in four groups, on five teams' rows, with its status coloured in Grist. */
export const demo: GristWidgetDemo = {
  tables: {
    Tasks: {
      columns: { Title: "Text", Start: "Date", End: "Date", Group: "Choice", Team: "Choice", Status: "Choice" },
      choices: {
        Group: ["Design", "Permits", "Works", "Handover"],
        Team: ["Architects", "Interior", "Builders", "Electricians", "Plumbers"],
        Status: ["Planned", "In progress", "Done", "Late"],
      },
      choiceColors: {
        Status: {
          Planned: { fillColor: "#E0E7FF", textColor: "#1E1B4B" },
          "In progress": { fillColor: "#2563EB", textColor: "#FFFFFF" },
          Done: { fillColor: "#15803D", textColor: "#FFFFFF" },
          Late: { fillColor: "#FDE68A", textColor: "#422006" },
        },
      },
      rows: TASKS.map(([Title, Group, Team, Start, days, Status]) => ({ Title, Start, End: plusDays(Start, days), Group, Team, Status })),
    },
  },
  mapping: { Title: "Title", Start: "Start", End: "End", Group: "Group", Sequence: "Team", Status: "Status" },
}
