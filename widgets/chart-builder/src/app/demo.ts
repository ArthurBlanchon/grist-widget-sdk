import type { GristWidgetDemo } from "grist-widget-sdk"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const REGIONS = ["North", "South", "East", "West", "Online"]

/** A year of sales, a row per month and region: the chart totals revenue and costs by month. */
export const demo: GristWidgetDemo = {
  tables: {
    Sales: {
      columns: { Month: "Text", Region: "Text", Revenue: "Numeric", Costs: "Numeric" },
      rows: MONTHS.flatMap((Month, m) =>
        REGIONS.map((Region, r) => {
          const Revenue = Math.round(8000 + 2500 * Math.sin((m + r) / 2) + 600 * m + 900 * r)
          return { Month, Region, Revenue, Costs: Math.round(Revenue * (0.55 + 0.04 * ((m * 7 + r * 3) % 5))) }
        }),
      ),
    },
  },
  mapping: { Label: "Month", Values: ["Revenue", "Costs"] },
  options: { chart: "bar", aggregate: "sum" },
}
