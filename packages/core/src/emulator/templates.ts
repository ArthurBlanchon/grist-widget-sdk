/**
 * Document templates exposed at the top of the emulator API.
 *
 * Templates return plain data — they don't allocate state, the caller passes
 * the returned value into `createGristEmulator(...)` which performs the allocation.
 */

import type { GristReplicaDocument } from "../sdk/replica-document"

const PRESET_GENERATED_AT = "1970-01-01T00:00:00.000Z"

function replicaBase(overrides: Omit<GristReplicaDocument, "generatedAt">): GristReplicaDocument {
  return {
    generatedAt: PRESET_GENERATED_AT,
    ...overrides,
  }
}

/**
 * Useful templates for quick demos and tests.
 */
export const presets = {
  /**
   * Default starter fixture for demos / sandboxes that need a neutral document
   * without choosing a domain-specific preset.
   */
  defaultTemplate(): GristReplicaDocument {
    return replicaBase({
      docName: "Default",
      tables: {
        Table1: {
          label: "Table1",
          rows: [
            { id: 1, Name: "Alice" },
            { id: 2, Name: "Bob" },
          ],
        },
      },
    })
  },
  blank(): GristReplicaDocument {
    return replicaBase({
      docName: "Blank",
      tables: {
        Table1: { rows: [{ id: 1 }] },
      },
    })
  },
  todoList(): GristReplicaDocument {
    return replicaBase({
      docName: "Todo list",
      mode: "schema+data",
      tables: {
        Tasks: {
          label: "Tasks",
          columns: {
            title: { type: "Text", label: "Title" },
            done: { type: "Bool", label: "Done" },
            priority: { type: "Choice", label: "Priority" },
          },
          rows: [
            { id: 1, title: "Buy milk", done: false, priority: "high" },
            { id: 2, title: "Write the SOTA emulator", done: true, priority: "high" },
            { id: 3, title: "Ship it", done: false, priority: "medium" },
          ],
        },
      },
    })
  },
  contacts(): GristReplicaDocument {
    return replicaBase({
      docName: "Contacts",
      mode: "schema+data",
      tables: {
        Contacts: {
          label: "Contacts",
          columns: {
            firstName: { type: "Text" },
            lastName: { type: "Text" },
            email: { type: "Text" },
            company: { type: "Text" },
          },
          rows: [
            { id: 1, firstName: "Ada", lastName: "Lovelace", email: "ada@analytical.engine", company: "British Crown" },
            { id: 2, firstName: "Linus", lastName: "Torvalds", email: "linus@kernel.org", company: "Linux Foundation" },
            { id: 3, firstName: "Margaret", lastName: "Hamilton", email: "margaret@apollo.nasa", company: "NASA" },
          ],
        },
      },
    })
  },
}
