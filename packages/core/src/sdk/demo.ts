/**
 * A widget's demo data (`src/app/demo.ts`, exported as `demo`): the
 * document its demo page, its real-Grist check and `create-grist-widget demo`
 * open, in place of generated sample rows. The demo page is public: invented
 * data only, and never a key in its options.
 *
 * ```ts
 * export const demo: GristWidgetDemo = {
 *   tables: {
 *     Tasks: {
 *       columns: { Title: "Text", Status: "Choice", Due: "Date" },
 *       choices: { Status: ["To do", "Done"] },
 *       rows: [{ Title: "Write the brief", Status: "To do", Due: "2026-12-01" }],
 *     },
 *   },
 * }
 * ```
 */
export type GristWidgetDemo = {
  /**
   * The document's tables: each column's type, the rows, and, for a Choice
   * or ChoiceList column, its choices in order (those the rows use are
   * added), and the colours Grist gives them. A `Date` is `"YYYY-MM-DD"`, a
   * `DateTime` an ISO string with its offset, a `ChoiceList` an array of
   * strings, a `Ref` the referenced row's position (1 for the first), a
   * `RefList` a list of positions, `Attachments` a list of file names in
   * `src/app/demo/` (images, PDFs, text or CSV files); a reference shows its
   * table's first column.
   */
  tables: Record<
    string,
    {
      columns: Record<string, GristWidgetDemoColumnType>
      rows: Array<Record<string, unknown>>
      choices?: Record<string, string[]>
      /** Per column, each choice's colours, as `"#RRGGBB"`: `{ Late: { fillColor: "#FDE68A" } }`. */
      choiceColors?: Record<string, Record<string, { fillColor?: string; textColor?: string }>>
    }
  >
  /** The widget's table, the document's first page: the first one when left out. */
  table?: string
  /** Each declared column's column (a list, for `allowMultiple`): the same name when left out. */
  mapping?: Record<string, string | string[]>
  /** The widget's options in the demo, under its current `optionsVersion`. */
  options?: Record<string, unknown>
}

/** The column types demo data takes. */
export type GristWidgetDemoColumnType =
  | "Text"
  | "Numeric"
  | "Int"
  | "Bool"
  | "Date"
  | "DateTime"
  | `DateTime:${string}`
  | "Choice"
  | "ChoiceList"
  | "Attachments"
  | "Any"
  | `Ref:${string}`
  | `RefList:${string}`
