import type { GristWidgetDemo } from "grist-widget-sdk"

const CANDIDATES: [string, string, string[]][] = [
  ["Amina Diallo", "Project manager", ["cv-amina-diallo.pdf"]],
  ["Lucas Moreau", "Data analyst", ["cv-lucas-moreau.pdf"]],
  ["Sofia Rossi", "UX designer", ["cv-sofia-rossi.pdf"]],
  ["Jonas Berg", "Data analyst", []],
  ["Chiara Romano", "Project manager", []],
  ["Mehdi Benali", "Developer", []],
  ["Elena Novak", "UX designer", []],
  ["Tom Becker", "Developer", []],
  ["Noor Hassan", "Project manager", []],
  ["Pablo Navarro", "Data analyst", []],
]

/** Job applications: a CV attachments column, a few candidates' files already there. */
export const demo: GristWidgetDemo = {
  tables: {
    Applications: {
      columns: { Name: "Text", Position: "Choice", CV: "Attachments" },
      choices: { Position: ["Project manager", "Data analyst", "UX designer", "Developer"] },
      rows: CANDIDATES.map(([Name, Position, CV]) => ({ Name, Position, CV })),
    },
  },
  mapping: { Files: "CV" },
}
