import type { GristWidgetDemo } from "grist-widget-sdk"

const TEMPLATE = `<p style="text-align:right">Atelier Martin<br>12 rue des Lilas, 69003 Lyon</p>
<p>{{Client}}<br>{{Address}}</p>
<p style="text-align:right">Lyon, {{Date}}</p>
<h2>Quote {{Number}}</h2>
<p>Dear {{Contact}},</p>
<p>Thank you for your request. For <strong>{{Work}}</strong>, our price is
<strong>{{Amount}} EUR</strong> excluding VAT, valid for thirty days.</p>
<p>The work can start two weeks after your signed approval.</p>
<p>Kind regards,<br>Paul Martin</p>`

/** Quotes, and a template that lays the selected one out as a letter. */
export const demo: GristWidgetDemo = {
  tables: {
    Quotes: {
      columns: { Number: "Text", Client: "Text", Contact: "Text", Address: "Text", Work: "Text", Date: "Date", Amount: "Numeric", Status: "Choice" },
      choices: { Status: ["Draft", "Sent", "Accepted", "Declined"] },
      rows: [
        { Number: "Q-2026-031", Client: "Café Tostado", Contact: "Ms Romero", Address: "4 place Bellecour, Lyon", Work: "a new counter in oak", Date: "2026-10-02", Amount: 4200, Status: "Accepted" },
        { Number: "Q-2026-032", Client: "Librairie Pages", Contact: "Mr Faure", Address: "18 rue Mercière, Lyon", Work: "twelve wall bookcases", Date: "2026-10-06", Amount: 7800, Status: "Sent" },
        { Number: "Q-2026-033", Client: "Studio Nord", Contact: "Ms Lindqvist", Address: "7 quai Saint-Vincent, Lyon", Work: "a meeting table for ten", Date: "2026-10-09", Amount: 2650, Status: "Declined" },
        { Number: "Q-2026-034", Client: "Hôtel des Arts", Contact: "Mr Benoît", Address: "33 cours Vitton, Lyon", Work: "the reception desk", Date: "2026-10-14", Amount: 6100, Status: "Accepted" },
        { Number: "Q-2026-035", Client: "Crèche Les Lutins", Contact: "Ms Petit", Address: "2 rue Garibaldi, Lyon", Work: "low shelves and coat racks", Date: "2026-10-20", Amount: 1980, Status: "Sent" },
        { Number: "Q-2026-036", Client: "Cabinet Morel", Contact: "Ms Morel", Address: "51 avenue Foch, Lyon", Work: "office fittings for four rooms", Date: "2026-10-23", Amount: 9350, Status: "Draft" },
        { Number: "Q-2026-037", Client: "Boulangerie Durand", Contact: "Mr Durand", Address: "9 rue de Brest, Lyon", Work: "bread display shelves", Date: "2026-10-28", Amount: 1420, Status: "Accepted" },
        { Number: "Q-2026-038", Client: "Galerie Ocre", Contact: "Ms Nguyen", Address: "26 montée de la Grande-Côte, Lyon", Work: "movable picture rails", Date: "2026-11-03", Amount: 890, Status: "Sent" },
        { Number: "Q-2026-039", Client: "Restaurant Le Quai", Contact: "Mr Rossi", Address: "14 quai Saint-Antoine, Lyon", Work: "a terrace screen in larch", Date: "2026-11-06", Amount: 3300, Status: "Draft" },
        { Number: "Q-2026-040", Client: "École Montessori", Contact: "Ms Garnier", Address: "40 rue Duguesclin, Lyon", Work: "classroom storage units", Date: "2026-11-10", Amount: 5150, Status: "Sent" },
      ],
    },
  },
  options: { template: TEMPLATE },
}
