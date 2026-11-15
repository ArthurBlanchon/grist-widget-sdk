import type { GristWidgetDemo } from "grist-widget-sdk"

/** A few processes as Mermaid code (cell mode), and an order's steps as From and To (rows mode). */
export const demo: GristWidgetDemo = {
  tables: {
    Processes: {
      columns: { Name: "Text", Diagram: "Text" },
      rows: [
        {
          Name: "Expense approval",
          Diagram: [
            "flowchart TD",
            "  A[Expense submitted] --> B{Over 500 EUR?}",
            "  B -- No --> C[Manager approves]",
            "  B -- Yes --> D[Finance reviews]",
            "  D --> C",
            "  C --> E[Paid with the next payroll]",
          ].join("\n"),
        },
        {
          Name: "Support ticket",
          Diagram: [
            "sequenceDiagram",
            "  participant C as Customer",
            "  participant S as Support",
            "  participant E as Engineering",
            "  C->>S: Reports a problem",
            "  S->>C: Acknowledges within the hour",
            "  S->>E: Escalates a bug",
            "  E-->>S: Fix released",
            "  S->>C: Confirms the fix",
          ].join("\n"),
        },
        {
          Name: "Office move",
          Diagram: [
            "gantt",
            "  dateFormat YYYY-MM-DD",
            "  section Preparation",
            "  Choose the movers :a1, 2026-12-01, 7d",
            "  Pack the archives :a2, after a1, 5d",
            "  section Move",
            "  Moving day :b1, 2026-12-15, 1d",
            "  Unpack and set up :b2, after b1, 3d",
          ].join("\n"),
        },
      ],
    },
    Steps: {
      columns: { From: "Text", To: "Text", Label: "Text" },
      rows: [
        { From: "Order received", To: "Payment checked", Label: "" },
        { From: "Payment checked", To: "Picked", Label: "paid" },
        { From: "Payment checked", To: "Cancelled", Label: "refused" },
        { From: "Picked", To: "Packed", Label: "" },
        { From: "Packed", To: "Shipped", Label: "label printed" },
        { From: "Shipped", To: "Delivered", Label: "" },
      ],
    },
  },
  table: "Processes",
  mapping: { Diagram: "Diagram" },
}
