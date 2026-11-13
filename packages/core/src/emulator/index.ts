/**
 * Public surface of the Grist emulator.
 *
 * A test harness: `grist-widget-sdk/emulator/testing` (renderWithGrist,
 * smokeTestWidget) is built on it. To see a widget in a real Grist, use
 * `pnpm demo` or its demo page (`create-grist-widget demo --save`).
 */

export type { GristReplicaDocument } from "../sdk/replica-document"
export { createGristEmulator } from "./create-grist-emulator"
export type { CreateGristEmulatorOptions, GristEmulator } from "./create-grist-emulator"
export { presets } from "./templates"
export { parseDocument, safeParseDocument } from "./validators"
export type {
  CreateDocumentInput,
  CreateDocumentTableInput,
  EmulatorColumn,
  EmulatorDocumentState,
  EmulatorEvent,
  EmulatorRowId,
  EmulatorTable,
} from "./core"
export { EmulatorActionError, enrichEmulatorColumnMetadata, resolveMappings } from "./core"
export type { EmulatorApiBundle } from "./api"
export type { EmulatorTransport, InlineGristGlobal } from "./transports"
