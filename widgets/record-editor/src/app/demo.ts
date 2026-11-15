import type { GristWidgetDemo } from "grist-widget-sdk"

const TITLES = [
  "Boiler service", "Leaking tap", "Replace the door lock", "Lift inspection", "Repaint the hallway",
  "Fix the gate motor", "Air conditioning check", "Broken window", "Smoke detector test", "Unblock the drain",
  "Replace light bulbs", "Roof gutter cleaning", "Heating not working", "Intercom fault", "Garage door noise",
  "Install a shelf", "Water heater pressure", "Repair the fence", "Check the fire doors", "Mould in the bathroom",
]
const STATUSES = ["New", "Planned", "In progress", "Done"]
const PRIORITIES = ["Low", "Normal", "High", "Urgent"]

/** A building's interventions, each with a technician from the Technicians table. */
export const demo: GristWidgetDemo = {
  tables: {
    Interventions: {
      columns: {
        Title: "Text",
        Status: "Choice",
        Priority: "Choice",
        Scheduled: "Date",
        Done: "Bool",
        Hours: "Numeric",
        Notes: "Text",
        Technician: "Ref:Technicians",
      },
      choices: { Status: STATUSES, Priority: PRIORITIES },
      rows: TITLES.map((Title, i) => {
        const status = STATUSES[(i * 3) % 4]
        return {
          Title,
          Status: status,
          Priority: PRIORITIES[(i * 5 + 1) % 4],
          Scheduled: `2026-11-${String(2 + i).padStart(2, "0")}`,
          Done: status === "Done",
          Hours: status === "New" ? 0 : 0.5 + ((i * 3) % 7) * 0.5,
          Notes: i % 3 === 0 ? "Tenant to be called the day before." : "",
          Technician: 1 + (i % 5),
        }
      }),
    },
    Technicians: {
      columns: { Name: "Text", Speciality: "Text" },
      rows: [
        { Name: "Karim Benali", Speciality: "Plumbing" },
        { Name: "Laura Pons", Speciality: "Electricity" },
        { Name: "Stefan Weber", Speciality: "Heating" },
        { Name: "Maëlle Durand", Speciality: "Carpentry" },
        { Name: "Ivan Petrov", Speciality: "General" },
      ],
    },
  },
  mapping: { Fields: ["Title", "Status", "Priority", "Scheduled", "Done", "Hours", "Technician", "Notes"] },
}
