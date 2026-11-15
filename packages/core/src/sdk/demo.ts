/**
 * A widget's demo data (`src/app/demo.ts`, exported as `demo`): the
 * document its demo page, its real-Grist check and its screenshots open,
 * in place of generated sample rows.
 *
 * ```ts
 * export const demo: GristWidgetDemo = {
 *   tables: {
 *     Tasks: {
 *       columns: { Title: "Text", Status: "Choice", Due: "Date" },
 *       rows: [{ Title: "Write the brief", Status: "To do", Due: "2026-12-01" }],
 *     },
 *   },
 * }
 * ```
 */
export type GristWidgetDemo = {
  /**
   * The document's tables, in order: each column's Grist type (`Text`,
   * `Numeric`, `Int`, `Bool`, `Date`, `DateTime`, `Choice`, `ChoiceList`,
   * `Ref:<Table>`, `Any`), and its rows. A `Date` is `"YYYY-MM-DD"`, a
   * `DateTime` an ISO string, a `ChoiceList` an array, a `Ref` the referenced
   * row's position (1 for the first).
   */
  tables: Record<string, { columns: Record<string, string>; rows: Array<Record<string, unknown>> }>
  /** The widget's table: the first one when left out. */
  table?: string
  /** Each declared column's column (or columns, for `allowMultiple`): the same name when left out. */
  mapping?: Record<string, string | string[]>
  /** The widget's options in the demo. */
  options?: Record<string, unknown>
}
