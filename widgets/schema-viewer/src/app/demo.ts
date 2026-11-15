import type { GristWidgetDemo } from "grist-widget-sdk"

/** A small CRM: companies, their contacts, the contacts' deals, and tags on the contacts. */
export const demo: GristWidgetDemo = {
  tables: {
    Companies: {
      columns: { Name: "Text", City: "Text", Sector: "Choice" },
      rows: [
        { Name: "Atelier Lumière", City: "Lyon", Sector: "Design" },
        { Name: "Nordic Bikes", City: "Copenhagen", Sector: "Retail" },
        { Name: "Quartz Labs", City: "Eindhoven", Sector: "Technology" },
        { Name: "Olive Grove Foods", City: "Thessaloniki", Sector: "Food" },
      ],
    },
    Contacts: {
      columns: { Name: "Text", Email: "Text", Company: "Ref:Companies", Tags: "RefList:Tags" },
      rows: [
        { Name: "Camille Roux", Email: "camille.roux@example.com", Company: 1, Tags: [1, 3] },
        { Name: "Freja Nielsen", Email: "freja.nielsen@example.com", Company: 2, Tags: [2] },
        { Name: "Daan de Vries", Email: "daan.devries@example.com", Company: 3, Tags: [1] },
        { Name: "Nikos Papadopoulos", Email: "nikos.p@example.com", Company: 4, Tags: [] },
        { Name: "Léa Martin", Email: "lea.martin@example.com", Company: 1, Tags: [2, 3] },
      ],
    },
    Deals: {
      columns: { Title: "Text", Contact: "Ref:Contacts", Amount: "Numeric", Stage: "Choice", Closing: "Date" },
      choices: { Stage: ["Lead", "Proposal", "Won", "Lost"] },
      rows: [
        { Title: "Showroom lighting", Contact: 1, Amount: 18000, Stage: "Proposal", Closing: "2026-12-15" },
        { Title: "Fleet of cargo bikes", Contact: 2, Amount: 42000, Stage: "Won", Closing: "2026-10-30" },
        { Title: "Sensor pilot", Contact: 3, Amount: 9500, Stage: "Lead", Closing: "2027-01-20" },
        { Title: "Olive oil range", Contact: 4, Amount: 6200, Stage: "Lost", Closing: "2026-09-12" },
        { Title: "Office fit-out", Contact: 5, Amount: 23500, Stage: "Proposal", Closing: "2027-02-01" },
      ],
    },
    Tags: {
      columns: { Name: "Text" },
      rows: [{ Name: "Key account" }, { Name: "Newsletter" }, { Name: "Event 2026" }],
    },
  },
}
