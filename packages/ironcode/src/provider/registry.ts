import type { LanguageModelV3 } from "@ai-sdk/provider"
import { Log } from "../util/log"

/**
 * Model Reference - A string identifier for models in "providerID:modelID" format
 *
 * @example
 * const ref: ModelRef = "anthropic:claude-sonnet-4-20250514"
 * const model = await ProviderRegistry.get(ref)
 */
export type ModelRef = string

/**
 * Provider Registry - Convenience layer for namespace-based model access
 *
 * Provides a simpler API using "provider:model" notation instead of separate provider/model params.
 * Built on top of the existing Provider system, so it's fully compatible and adds zero overhead.
 *
 * @example
 * // Old way:
 * const model = await Provider.getModel("anthropic", "claude-sonnet-4.5")
 * const language = await Provider.getLanguage(model)
 *
 * // New way (more concise):
 * const language = await ProviderRegistry.get("anthropic:claude-sonnet-4.5")
 */
export namespace ProviderRegistry {
  const log = Log.create({ service: "provider-registry" })

  /**
   * Get language model using namespace format: "providerID:modelID"
   *
   * This is a convenience wrapper around Provider.getModel() + Provider.getLanguage().
   * Models are cached in the Provider layer, so this has the same performance characteristics.
   *
   * @example
   * const model = await ProviderRegistry.get("anthropic:claude-sonnet-4.5")
   * const model2 = await ProviderRegistry.get("openai:gpt-5.1")
   * const model3 = await ProviderRegistry.get("google:gemini-3-flash")
   */
  export async function get(id: ModelRef | string): Promise<LanguageModelV3> {
    const { providerID, modelID } = parse(id)
    const { Provider } = await import("./provider")

    log.debug("get", { providerID, modelID })

    const model = await Provider.getModel(providerID, modelID)
    return Provider.getLanguage(model)
  }

  /**
   * Parse namespace format "providerID:modelID" or "providerID/modelID" into components
   *
   * @example
   * parse("anthropic:claude-sonnet-4.5") // { providerID: "anthropic", modelID: "claude-sonnet-4.5" }
   * parse("github-copilot/gpt-5-mini") // { providerID: "github-copilot", modelID: "gpt-5-mini" }
   * parse("openrouter:anthropic/claude-3-opus") // { providerID: "openrouter", modelID: "anthropic/claude-3-opus" }
   */
  export function parse(id: ModelRef | string): { providerID: string; modelID: string } {
    // Prefer ":" separator, fallback to "/" if no ":" found
    let separatorIndex = id.indexOf(":")
    if (separatorIndex === -1) {
      separatorIndex = id.indexOf("/")
    }
    if (separatorIndex === -1) {
      throw new Error(
        `Invalid provider registry ID format: "${id}". Expected "providerID:modelID" or "providerID/modelID"`,
      )
    }

    const providerID = id.slice(0, separatorIndex)
    const modelID = id.slice(separatorIndex + 1)

    if (!providerID || !modelID) {
      throw new Error(`Invalid provider registry ID format: "${id}". Both providerID and modelID must be non-empty`)
    }

    return { providerID, modelID }
  }

  /**
   * Format providerID and modelID into namespace format "providerID:modelID"
   *
   * @example
   * format("anthropic", "claude-sonnet-4.5") // "anthropic:claude-sonnet-4.5"
   * format("openrouter", "anthropic/claude-3-opus") // "openrouter:anthropic/claude-3-opus"
   */
  export function format(providerID: string, modelID: string): ModelRef {
    return `${providerID}:${modelID}`
  }

  /**
   * List all available models in namespace format
   *
   * @example
   * const models = await ProviderRegistry.list()
   * // ["anthropic:claude-sonnet-4.5", "openai:gpt-5.1", "google:gemini-3-flash", ...]
   */
  export async function list(): Promise<ModelRef[]> {
    const { Provider } = await import("./provider")
    const providers = await Provider.list()

    const models: ModelRef[] = []
    for (const [providerID, provider] of Object.entries(providers)) {
      for (const modelID of Object.keys(provider.models)) {
        models.push(format(providerID, modelID))
      }
    }

    return models.sort()
  }
}
