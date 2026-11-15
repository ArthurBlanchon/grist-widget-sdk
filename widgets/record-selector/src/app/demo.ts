import type { GristWidgetDemo } from "grist-widget-sdk"

const CLIENTS: [string, string, string][] = [
  ["Atelier Lumière", "Lyon", "Camille Roux"],
  ["Baltic Timber", "Riga", "Jānis Ozols"],
  ["Café Tostado", "Seville", "Lucía Romero"],
  ["Danube Logistics", "Vienna", "Lukas Gruber"],
  ["Elbe Solar", "Hamburg", "Mia Schneider"],
  ["Fjord Seafood", "Bergen", "Ingrid Hansen"],
  ["Granite Works", "Aberdeen", "Fiona Campbell"],
  ["Helvetia Watches", "Geneva", "Luca Bernasconi"],
  ["Iberia Textiles", "Porto", "João Ferreira"],
  ["Jura Cheese Co.", "Besançon", "Hugo Girard"],
  ["Kraków Print House", "Kraków", "Zofia Nowak"],
  ["Lagoon Glass", "Venice", "Giulia Ricci"],
  ["Maple & Oak", "Dublin", "Siobhán Byrne"],
  ["Nordic Bikes", "Copenhagen", "Freja Nielsen"],
  ["Olive Grove Foods", "Thessaloniki", "Nikos Papadopoulos"],
  ["Pannonia Wines", "Budapest", "Eszter Tóth"],
  ["Quartz Labs", "Eindhoven", "Daan de Vries"],
  ["Rhine Robotics", "Basel", "Nina Keller"],
  ["Saffron Spices", "Valencia", "Pablo Navarro"],
  ["Tatra Outdoor", "Bratislava", "Martin Kováč"],
  ["Urban Gardens", "Brussels", "Elise Peeters"],
  ["Vltava Studio", "Prague", "Tereza Dvořáková"],
  ["Wadden Ferries", "Groningen", "Sanne Bakker"],
  ["Xenia Hotels", "Athens", "Eleni Georgiou"],
  ["Yarra Coffee", "Milan", "Marco Colombo"],
  ["Zephyr Kites", "Brest", "Yann Le Goff"],
  ["Aurora Optics", "Helsinki", "Aino Virtanen"],
  ["Bastide Ceramics", "Aix-en-Provence", "Léa Martin"],
  ["Cascade Water", "Ljubljana", "Ana Kovač"],
  ["Dune Surf School", "Biarritz", "Mathis Etcheverry"],
]

/** A client list: a company per row, its city as subtitle, and its contact to search by. */
export const demo: GristWidgetDemo = {
  tables: {
    Clients: {
      columns: { Company: "Text", City: "Text", Contact: "Text" },
      rows: CLIENTS.map(([Company, City, Contact]) => ({ Company, City, Contact })),
    },
  },
  mapping: { Title: "Company", Subtitle: "City", Search: ["Contact"] },
}
