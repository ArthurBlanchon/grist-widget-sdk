import type {
  GristCursorPos,
  GristDocApi,
  GristFetchSelectedOptions,
  GristReadyOptions,
  GristTableOperations,
  GristWidgetColumnMap,
  GristWidgetInteraction,
} from "./types"

declare global {
  const grist: {
    ready: (options?: GristReadyOptions) => Promise<void> | void
    onRecord: (
      cb: (
        record: Record<string, unknown> | null,
        mappings?: GristWidgetColumnMap | null
      ) => void,
      options?: GristFetchSelectedOptions
    ) => void
    onRecords: (
      cb: (
        records: Record<string, unknown>[],
        mappings?: GristWidgetColumnMap | null
      ) => void,
      options?: GristFetchSelectedOptions
    ) => void
    onOptions: (cb: (options: Record<string, unknown> | null, interaction: GristWidgetInteraction) => void) => void
    onNewRecord?: (cb: (mappings: GristWidgetColumnMap | null) => void) => void
    /** Forward map: real-table column ids replaced with logical widget names. Returns null if required columns aren't mapped. */
    mapColumnNames?: (
      data: Record<string, unknown>,
      options?: { reverse?: boolean }
    ) => Record<string, unknown> | null
    /** Reverse map: logical widget names replaced with real column ids (for writes). */
    mapColumnNamesBack?: (data: Record<string, unknown>) => Record<string, unknown>
    getOptions: () => Promise<Record<string, unknown> | null>
    getOption: (key: string) => Promise<unknown>
    setOption: (key: string, value: unknown) => Promise<void>
    setOptions: (options: Record<string, unknown>) => Promise<void>
    clearOptions: () => Promise<void>
    setCursorPos?: (pos: GristCursorPos) => Promise<void>
    setSelectedRows?: (rowIds: null | number[]) => Promise<void>
    fetchSelectedTable?: (options?: GristFetchSelectedOptions) => Promise<Record<string, unknown[]>>
    fetchSelectedRecord?: (rowId: number, options?: GristFetchSelectedOptions) => Promise<Record<string, unknown>>
    docApi: GristDocApi
    selectedTable?: GristTableOperations
    /** Get a `TableOperations` handle for any table in the document. */
    getTable?: (tableId?: string) => GristTableOperations
    /** Custom Section API — declares column requirements after `ready` and reads current mappings. */
    sectionApi?: {
      configure: (options: GristReadyOptions) => Promise<void>
      mappings: () => Promise<GristWidgetColumnMap | null>
    }
    /** Generic event subscribe (used for theme messages and other internal RPCs). */
    on?: (eventName: string, listener: (...args: unknown[]) => void) => unknown
  }
}

export {}
