import type { GristWidgetDemo } from "grist-widget-sdk"

// Place, date, files (photos of src/app/demo/, and the inspection report).
const VISITS: [string, string, string[]][] = [
  ["North façade", "2026-11-04", ["facade-north.jpg", "facade-crack.jpg"]],
  ["Roof", "2026-11-04", ["roof.jpg"]],
  ["Boiler room", "2026-11-04", ["boiler-room.jpg", "inspection-report.pdf"]],
  ["Main staircase", "2026-11-04", ["staircase.jpg"]],
  ["Car park", "2026-11-05", ["car-park.jpg"]],
  ["Garden", "2026-11-05", ["garden.jpg"]],
  ["Roof terrace", "2026-11-05", ["terrace.jpg", "roof.jpg"]],
  ["Crack, after the gauges", "2026-11-12", ["facade-crack.jpg"]],
  ["Lobby", "2026-11-12", []],
  ["Bike shed", "2026-11-12", ["car-park.jpg", "garden.jpg"]],
  ["North façade, scaffolding", "2026-11-13", ["facade-north.jpg"]],
  ["Boiler, after the service", "2026-11-13", ["boiler-room.jpg"]],
  ["Stairwell windows", "2026-11-14", ["staircase.jpg", "facade-north.jpg"]],
  ["Courtyard", "2026-11-14", ["garden.jpg", "terrace.jpg", "car-park.jpg"]],
  ["Roof, tiles replaced", "2026-11-14", ["roof.jpg"]],
]

/** A building's site visits, a place per row with its photos, and the inspection report among them. */
export const demo: GristWidgetDemo = {
  tables: {
    Visits: {
      columns: { Place: "Text", Visited: "Date", Photos: "Attachments" },
      rows: VISITS.map(([Place, Visited, Photos]) => ({ Place, Visited, Photos })),
    },
  },
  mapping: { Files: "Photos", Caption: "Place" },
}
