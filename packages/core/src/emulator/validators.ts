import { z } from "zod"

import type { GristReplicaDocument } from "../sdk/replica-document"

const emulatorRowSchema = z
  .object({ id: z.number() })
  .catchall(z.unknown())

const formulaKindSchema = z.enum(["computed", "trigger", "none", "empty_slot"])

const replicaColumnSchema = z
  .object({
    colRef: z.number().optional(),
    type: z.string().optional(),
    label: z.string().optional(),
    parentPos: z.number().optional(),
    isFormula: z.boolean().optional(),
    formulaKind: formulaKindSchema.optional(),
    formula: z.string().optional(),
    description: z.string().optional(),
    widgetOptions: z.record(z.string(), z.unknown()).optional(),
    displayColRef: z.number().optional(),
    visibleColRef: z.number().optional(),
  })
  .strict()

const replicaTableSchema = z
  .object({
    label: z.string().optional(),
    columns: z.record(z.string(), replicaColumnSchema).optional(),
    rows: z.array(emulatorRowSchema).optional(),
    rowCount: z.number().optional(),
    dataOmitted: z.boolean().optional(),
    dataOmittedReason: z.string().optional(),
    error: z.string().optional(),
  })
  .strict()

const replicaSelectionSchema = z
  .object({
    tableId: z.string().optional(),
    rowId: z.union([z.number(), z.literal("new"), z.null()]).optional(),
    mappings: z.unknown().nullable().optional(),
    cursor: z.unknown().optional(),
  })
  .strict()

const replicaWidgetConfigurationSchema = z
  .object({
    requiredAccess: z.string().optional(),
    columns: z.unknown().optional(),
    allowSelectBy: z.boolean().optional(),
    hasCustomOptions: z.boolean().optional(),
  })
  .strict()

const replicaAccessTokenSchema = z
  .object({
    token: z.string(),
    baseUrl: z.string(),
    ttlMsecs: z.number(),
  })
  .strict()

const replicaDocumentSchema = z
  .object({
    generatedAt: z.string(),
    source: z.string().optional(),
    docName: z.string().optional(),
    mode: z.enum(["schema-only", "schema+samples", "schema+data"]).optional(),
    tables: z.record(z.string(), replicaTableSchema),
    selection: replicaSelectionSchema.optional(),
    widgetOptions: z.record(z.string(), z.unknown()).optional(),
    widgetInteraction: z.unknown().optional(),
    configuration: replicaWidgetConfigurationSchema.optional(),
    accessToken: replicaAccessTokenSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value.tables).length > 0, {
    message: "at least one table is required",
    path: ["tables"],
  })

function formatZodError(prefix: string, error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => {
      const where = issue.path.length > 0 ? issue.path.join(".") : "<root>"
      return `${where}: ${issue.message}`
    })
    .join("; ")
  return new Error(`${prefix}: ${details}`)
}

export function safeParseDocument(input: unknown) {
  return replicaDocumentSchema.safeParse(input)
}

export function parseDocument(input: unknown): GristReplicaDocument {
  const result = safeParseDocument(input)
  if (!result.success) {
    throw formatZodError("parseDocument", result.error)
  }
  return result.data as GristReplicaDocument
}
