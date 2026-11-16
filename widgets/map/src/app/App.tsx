import { lazy } from "react"

import { defineGristWidget } from "grist-widget-sdk"
import { reportUrl } from "@shared/report-url"

export const widget = defineGristWidget({
  title: "Map",
  description: "Rows as points by their coordinates, coloured by category and clustered; or countries coloured by a value. Clicking a point selects its row.",
  reportUrl: reportUrl(),
  requiredAccess: "read table",
  allowSelectBy: true,
  columns: [
    { name: "Latitude", type: "Numeric", optional: true, title: "Latitude (points)" },
    { name: "Longitude", type: "Numeric", optional: true, title: "Longitude (points)" },
    { name: "Label", optional: true, title: "Label of a point" },
    { name: "Category", optional: true, title: "Category (a point's colour)" },
    { name: "Country", type: "Text", optional: true, title: "Country, as an ISO code (countries mode)" },
    { name: "Value", type: "Numeric,Int", optional: true, title: "Value to colour countries by (rows are counted without it)" },
  ],
})

/**
 * MapLibre loads in a chunk of its own, after the Grist handshake:
 * mountGristWidget() renders the widget inside <Suspense>.
 */
export default lazy(() => import("./MapView"))
