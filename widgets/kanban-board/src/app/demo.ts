import type { GristWidgetDemo } from "grist-widget-sdk"

/** A team's tasks across four columns, as the spec's Demo data says: the demo page and the real-Grist check open it. */
export const demo: GristWidgetDemo = {
  tables: {
    Tasks: {
      columns: { Title: "Text", Status: "Choice", Notes: "Text" },
      rows: [
        { Title: "Write the launch brief", Status: "Done", Notes: "Shared with marketing on Monday." },
        { Title: "Pick the venue", Status: "Done", Notes: "" },
        { Title: "Draft the invitation", Status: "Review", Notes: "Waiting for Léa's comments." },
        { Title: "Book the caterer", Status: "Review", Notes: "Two quotes to compare." },
        { Title: "Order the badges", Status: "Doing", Notes: "" },
        { Title: "Set up registrations", Status: "Doing", Notes: "Form ready, payment page to test." },
        { Title: "Plan the seating", Status: "To do", Notes: "" },
        { Title: "Brief the speakers", Status: "To do", Notes: "Send the timetable first." },
        { Title: "Print the programme", Status: "To do", Notes: "" },
        { Title: "Write the thank-you note", Status: "To do", Notes: "" },
      ],
    },
  },
  options: { columns: ["To do", "Doing", "Review", "Done"] },
}
