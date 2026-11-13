/**
 * `defineGristWidget()`: a widget's whole declaration in one typed value.
 * Everything else reads it: `widget.useGrist()` types the mapped records and
 * the writes from it, `mountGristWidget()` takes the access level, the
 * columns and the title from it, and the tests map its columns.
 *
 * ```ts
 * export const widget = defineGristWidget({
 *   title: "Tasks",
 *   requiredAccess: "full",
 *   columns: [{ name: "Title", type: "Text" }, { name: "Done", type: "Bool" }],
 * })
 *
 * const w = widget.useGrist()   // w.mappedRecord: { id; Title: string | null; Done: boolean | null } | null
 * await w.updateRecord({ Done: true })
 * ```
 */

import type { GristMappedRow } from "./runtime/cells"
import type { GristRowRecord } from "./types"
import { useGrist, type UseGristOptions, type UseGristResult } from "./use-grist"

/** What a widget declares: `UseGristOptions`, plus its title and description. */
export type GristWidgetDefinition = UseGristOptions & {
  /** The widget's name: the page's title, and its manifest's. */
  title?: string
  /** One sentence: the page's description, and its manifest's. */
  description?: string
}

/** The widget's mapped record type, from its declaration. */
export type GristWidgetRow<W> = W extends GristWidget<infer D> ? GristMappedRow<D> : never

/** A declared widget. Pass it to `mountGristWidget()` (as `widget`, exported from `src/app/App.tsx`). */
export type GristWidget<D extends GristWidgetDefinition = GristWidgetDefinition> = {
  /** The declaration, as written. */
  readonly definition: D
  /** What the widget asks Grist for: the declaration without its title and description. */
  readonly options: UseGristOptions
  readonly metadata: { title?: string; description?: string }
  /**
   * `useGrist()`, typed from the declaration: `mappedRecord`, `mappedRecords`,
   * `mapBack`, `updateRecord` and `addRecord` use the declared names and the
   * value each declared type gives. A hook: call it in a component.
   */
  useGrist: () => UseGristResult<GristRowRecord, GristMappedRow<D>>
}

/**
 * Declares a widget. The `const` type parameter keeps the column names and
 * types literal, so the mapped record is typed with no annotation, no
 * `as const` and no generics.
 */
export function defineGristWidget<const D extends GristWidgetDefinition>(definition: D): GristWidget<D> {
  const { title, description, ...options } = definition
  return {
    definition,
    options,
    metadata: { title, description },
    useGrist: () => useGrist<GristRowRecord, GristMappedRow<D>>(options),
  }
}

/** True for a declared widget (as opposed to plain `GRIST_OPTIONS`). */
export function isGristWidget(value: unknown): value is GristWidget {
  return typeof value === "object" && value !== null && "definition" in value && "useGrist" in value
}
