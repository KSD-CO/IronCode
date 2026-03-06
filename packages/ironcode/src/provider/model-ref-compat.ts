import z from "zod"
import { ProviderRegistry, type ModelRef } from "./registry"

/**
 * Zod schema that accepts BOTH legacy {providerID, modelID} AND new ModelRef string format
 * Automatically converts legacy format to ModelRef during parse
 *
 * This allows gradual migration without breaking existing data
 */
export const ModelRefSchema = z
  .union([
    // New format: "provider:model" string
    z.string(),
    // Legacy format: {providerID, modelID} object
    z.object({
      providerID: z.string(),
      modelID: z.string(),
    }),
  ])
  .transform((val): ModelRef => {
    if (typeof val === "string") {
      return val as ModelRef
    }
    // Convert legacy format to ModelRef
    return ProviderRegistry.format(val.providerID, val.modelID)
  })

/**
 * Helper to ensure a value is ModelRef (converts if needed)
 */
export function ensureModelRef(val: ModelRef | { providerID: string; modelID: string } | string): ModelRef {
  if (typeof val === "string") {
    return val as ModelRef
  }
  return ProviderRegistry.format(val.providerID, val.modelID)
}

/**
 * Zod schema for optional ModelRef (accepts both formats)
 */
export const ModelRefOptionalSchema = ModelRefSchema.optional()
