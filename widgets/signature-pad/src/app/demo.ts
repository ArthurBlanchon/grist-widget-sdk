import type { GristWidgetDemo } from "grist-widget-sdk"

const DELIVERIES: [string, string][] = [
  ["Boulangerie Durand", "9 rue de Brest, Lyon"],
  ["Café Tostado", "4 place Bellecour, Lyon"],
  ["Librairie Pages", "18 rue Mercière, Lyon"],
  ["Hôtel des Arts", "33 cours Vitton, Lyon"],
  ["Galerie Ocre", "26 montée de la Grande-Côte, Lyon"],
  ["Cabinet Morel", "51 avenue Foch, Lyon"],
  ["Crèche Les Lutins", "2 rue Garibaldi, Lyon"],
  ["Studio Nord", "7 quai Saint-Vincent, Lyon"],
  ["Restaurant Le Quai", "14 quai Saint-Antoine, Lyon"],
  ["École Montessori", "40 rue Duguesclin, Lyon"],
]
const SIGNED = [
  { Signature: ["signature-pascal-girard.png"], SignedBy: "Pascal Girard", SignedAt: "2026-11-13T09:42:00+01:00" },
  { Signature: ["signature-ines-roux.png"], SignedBy: "Inès Roux", SignedAt: "2026-11-13T11:05:00+01:00" },
]

/** A day's deliveries, the first two already signed. */
export const demo: GristWidgetDemo = {
  tables: {
    Deliveries: {
      columns: { Customer: "Text", Address: "Text", Signature: "Attachments", SignedBy: "Text", SignedAt: "DateTime:Europe/Paris" },
      rows: DELIVERIES.map(([Customer, Address], i) => ({ Customer, Address, ...(SIGNED[i] ?? { Signature: [], SignedBy: "", SignedAt: null }) })),
    },
  },
  mapping: { Signature: "Signature", SignedBy: "SignedBy", SignedAt: "SignedAt" },
}
