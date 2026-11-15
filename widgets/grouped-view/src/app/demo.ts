import type { GristWidgetDemo } from "grist-widget-sdk"

const PEOPLE = ["Amina", "Bruno", "Chloé", "Dmitri", "Elena"]
const CATEGORIES = ["Travel", "Meals", "Equipment", "Software", "Training"]
const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"]

/** A team's expenses over four months, grouped by category, a person per row, months across. */
export const demo: GristWidgetDemo = {
  tables: {
    Expenses: {
      columns: { Category: "Text", Month: "Text", Person: "Text", Amount: "Numeric" },
      rows: Array.from({ length: 40 }, (_, i) => ({
        Category: CATEGORIES[(i * 3) % CATEGORIES.length],
        Month: MONTHS[i % MONTHS.length],
        Person: PEOPLE[(i * 2 + Math.floor(i / 5)) % PEOPLE.length],
        Amount: Math.round((25 + ((i * 37) % 180) + (i % 4) * 12.5) * 100) / 100,
      })),
    },
  },
  mapping: { Group: "Category", Label: "Person", Across: "Month", Value: "Amount" },
}
