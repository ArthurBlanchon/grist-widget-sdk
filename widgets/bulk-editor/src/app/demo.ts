import type { GristWidgetDemo } from "grist-widget-sdk"

const TASKS = [
  "Renew the domain", "Update the privacy page", "Order new laptops", "Plan the team offsite",
  "Review supplier contracts", "Clean up the shared drive", "Prepare the Q4 budget", "Archive old invoices",
  "Book the trade fair stand", "Translate the brochure", "Test the backup restore", "Write the onboarding guide",
  "Replace the meeting-room screen", "Survey customer satisfaction", "Update the price list", "Fix the website contact form",
  "Renew the insurance", "Train the new interns", "Migrate the mailing list", "Order business cards",
  "Check fire extinguishers", "Refresh the product photos", "Close the September accounts", "Draft the newsletter",
  "Install the new printer", "Collect timesheets", "Audit software licences", "Send the holiday schedule",
  "Prepare the board slides", "Order the Christmas gifts",
]
const OWNERS = ["Inès", "Tom", "Sara", "Mehdi", "Julia"]
const STATUSES = ["To do", "Doing", "Done"]

/** A team's tasks with a Status to set in bulk; the widget's column is Status. */
export const demo: GristWidgetDemo = {
  tables: {
    Tasks: {
      columns: { Title: "Text", Status: "Choice", Owner: "Text", Due: "Date" },
      choices: { Status: STATUSES },
      rows: TASKS.map((Title, i) => ({
        Title,
        Status: STATUSES[(i * 2) % 3],
        Owner: OWNERS[i % OWNERS.length],
        Due: `2026-12-${String(1 + ((i * 5) % 28)).padStart(2, "0")}`,
      })),
    },
  },
  mapping: { Target: "Status" },
}
