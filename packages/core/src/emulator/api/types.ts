/**
 * Type-only signatures of the Grist plugin interfaces that the emulator
 * exposes to the widget.
 *
 * These mirror the upstream `grist-plugin-api` contracts. We re-declare them
 * here instead of `import`ing the upstream types because:
 *   - we don't depend on `grist-plugin-api` runtime,
 *   - the emulator is the single source of truth for what's testable.
 */

export type GristViewImpl = {
  /**
   * Always returns Grist's **columnar** wire shape. The `format` option is
   * accepted for protocol fidelity (the production `grist-plugin-api.js`
   * always forwards it) but the host stub MUST ignore it: the wrapper inside
   * the plugin script is the one that does the rows transposition. See
   * `api/grist-view.ts` and `transports/inline.ts` for the consumer side.
   */
  fetchSelectedTable: (
    options?: { keepEncoded?: boolean; format?: "rows" | "columns" }
  ) => Promise<Record<string, unknown[]>>
  fetchSelectedRecord: (
    rowId: number,
    options?: { keepEncoded?: boolean }
  ) => Promise<Record<string, unknown>>
  allowSelectBy: () => Promise<boolean>
  setSelectedRows: (rowIds: number[] | null) => Promise<void>
  setCursorPos: (cursor: { rowId?: number; field?: string; sectionId?: number }) => Promise<void>
}

export type GristDocApiImpl = {
  getDocName: () => Promise<string>
  listTables: () => Promise<string[]>
  fetchTable: (tableId: string) => Promise<Record<string, unknown[]>>
  applyUserActions: (
    actions: unknown[][],
    options?: { desc?: string }
  ) => Promise<{ retValues: unknown[] }>
  getAccessToken: (options?: { readOnly?: boolean }) => Promise<{ token: string; baseUrl: string; ttlMsecs: number }>
}

export type WidgetApiImpl = {
  getOption: (key: string) => Promise<unknown>
  setOption: (key: string, value: unknown) => Promise<void>
  getOptions: () => Promise<Record<string, unknown> | null>
  setOptions: (options: Record<string, unknown>) => Promise<void>
  clearOptions: () => Promise<void>
}

export type CustomSectionApiImpl = {
  configure: (settings: Record<string, unknown>) => Promise<void>
  mappings: () => Promise<Record<string, string | string[] | undefined> | null>
}

/**
 * Top-level Grist plugin RPC (the `_grist_api` interface). Used by the
 * widget to subscribe to events such as "onMessage" relays. Keeps a minimal
 * surface in v1 — extend as widget needs grow.
 */
export type GristApiImpl = {
  /** No-op echo helpful for protocol-level health checks. */
  ping: () => Promise<"pong">
}

export type CommandApiImpl = {
  /** Runs a registered command by name. The emulator currently no-ops. */
  run: (name: string) => Promise<void>
}
