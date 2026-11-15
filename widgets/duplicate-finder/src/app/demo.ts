import type { GristWidgetDemo } from "grist-widget-sdk"

/** Contacts with a few written twice (an accent, a capital, a typo), and orders that refer to them. */
export const demo: GristWidgetDemo = {
  tables: {
    Contacts: {
      columns: { Name: "Text", Email: "Text", Company: "Text", City: "Text" },
      rows: [
        { Name: "Hélène Dubois", Email: "helene.dubois@example.com", Company: "Atelier Lumière", City: "Lyon" },
        { Name: "Marco Bianchi", Email: "marco.bianchi@example.com", Company: "Lagoon Glass", City: "Venice" },
        { Name: "Sophie Wagner", Email: "s.wagner@example.com", Company: "Elbe Solar", City: "Hamburg" },
        { Name: "Pieter Jansen", Email: "pieter@example.com", Company: "Quartz Labs", City: "Eindhoven" },
        { Name: "Helene Dubois", Email: "helene.dubois@example.com", Company: "Atelier Lumiere", City: "Lyon" },
        { Name: "Ana García", Email: "ana.garcia@example.com", Company: "Saffron Spices", City: "Valencia" },
        { Name: "Oliver Smith", Email: "oliver.smith@example.com", Company: "Granite Works", City: "Aberdeen" },
        { Name: "Katarzyna Lewandowska", Email: "k.lewandowska@example.com", Company: "Kraków Print House", City: "Kraków" },
        { Name: "marco bianchi", Email: "Marco.Bianchi@example.com", Company: "Lagoon Glass", City: "Venice" },
        { Name: "Lars Eriksson", Email: "lars.eriksson@example.com", Company: "Nordic Bikes", City: "Copenhagen" },
        { Name: "Chiara Romano", Email: "chiara.romano@example.com", Company: "Yarra Coffee", City: "Milan" },
        { Name: "Tomás Silva", Email: "tomas.silva@example.com", Company: "Iberia Textiles", City: "Porto" },
        { Name: "Sophie Wagnr", Email: "s.wagner@example.com", Company: "Elbe Solar", City: "Hamburg" },
        { Name: "Emma Laurent", Email: "emma.laurent@example.com", Company: "Bastide Ceramics", City: "Aix-en-Provence" },
        { Name: "Jakub Novák", Email: "jakub.novak@example.com", Company: "Vltava Studio", City: "Prague" },
        { Name: "Aoife Murphy", Email: "aoife.murphy@example.com", Company: "Maple & Oak", City: "Dublin" },
        { Name: "Dimitra Kostas", Email: "dimitra.kostas@example.com", Company: "Xenia Hotels", City: "Athens" },
        { Name: "Tomas Silva", Email: "tomas.silva@example.com", Company: "Iberia Textiles", City: "Porto" },
        { Name: "Felix Huber", Email: "felix.huber@example.com", Company: "Danube Logistics", City: "Vienna" },
        { Name: "Noor Hassan", Email: "noor.hassan@example.com", Company: "Urban Gardens", City: "Brussels" },
        { Name: "Matteo Conti", Email: "matteo.conti@example.com", Company: "Rhine Robotics", City: "Basel" },
        { Name: "Eva Horváth", Email: "eva.horvath@example.com", Company: "Pannonia Wines", City: "Budapest" },
        { Name: "Lars Ericsson", Email: "lars.eriksson@example.com", Company: "Nordic Bikes", City: "Copenhagen" },
        { Name: "Ruth Cohen", Email: "ruth.cohen@example.com", Company: "Aurora Optics", City: "Helsinki" },
        { Name: "Yann Le Goff", Email: "yann.legoff@example.com", Company: "Zephyr Kites", City: "Brest" },
      ],
    },
    Orders: {
      columns: { Contact: "Ref:Contacts", Product: "Text", Amount: "Numeric" },
      rows: [
        { Contact: 1, Product: "Pendant lamps", Amount: 1240 },
        { Contact: 5, Product: "Wall lights", Amount: 380 },
        { Contact: 2, Product: "Glass vases", Amount: 960 },
        { Contact: 9, Product: "Glass beads", Amount: 145 },
        { Contact: 3, Product: "Solar panels", Amount: 5400 },
        { Contact: 13, Product: "Inverter", Amount: 1150 },
        { Contact: 10, Product: "City bikes", Amount: 2980 },
        { Contact: 23, Product: "Bike locks", Amount: 210 },
        { Contact: 12, Product: "Linen sheets", Amount: 730 },
        { Contact: 18, Product: "Towels", Amount: 260 },
      ],
    },
  },
  mapping: { Keys: ["Name", "Email"] },
}
