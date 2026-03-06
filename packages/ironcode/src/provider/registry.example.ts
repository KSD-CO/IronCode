// Example: Using ProviderRegistry for simpler model access
//
// ProviderRegistry provides a convenience layer for accessing language models
// using namespace notation (providerID:modelID) instead of separate provider/model params.
//
// This is built on top of the existing Provider system and is fully backward-compatible.

import { ProviderRegistry } from "@/provider/provider"
import { streamText } from "ai"

// ============================================================================
// Basic Usage
// ============================================================================

// Old way (still works):
import { Provider } from "@/provider/provider"

const model1 = await Provider.getModel("anthropic", "claude-sonnet-4-20250514")
const language1 = await Provider.getLanguage(model1)

// New way (more concise):
const language2 = await ProviderRegistry.get("anthropic:claude-sonnet-4-20250514")

// Both return the same cached LanguageModelV3 instance
console.assert(language1 === language2)

// ============================================================================
// Listing Available Models
// ============================================================================

// Get all available models in namespace format
const allModels = await ProviderRegistry.list()
// Returns: ["anthropic:claude-sonnet-4-20250514", "openai:gpt-5.1", "google:gemini-3-flash", ...]

console.log("Available models:", allModels.length)
for (const model of allModels) {
  console.log(`  - ${model}`)
}

// ============================================================================
// Parsing and Formatting
// ============================================================================

// Parse namespace string into components
const parsed = ProviderRegistry.parse("anthropic:claude-sonnet-4-20250514")
console.log(parsed) // { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" }

// Format components into namespace string
const formatted = ProviderRegistry.format("anthropic", "claude-sonnet-4-20250514")
console.log(formatted) // "anthropic:claude-sonnet-4-20250514"

// Handles model IDs with slashes (e.g., OpenRouter)
const openrouterModel = ProviderRegistry.parse("openrouter:anthropic/claude-3-opus")
console.log(openrouterModel) // { providerID: "openrouter", modelID: "anthropic/claude-3-opus" }

// ============================================================================
// Using with AI SDK streamText
// ============================================================================

// Direct usage with AI SDK
const model = await ProviderRegistry.get("anthropic:claude-sonnet-4-20250514")
const result = await streamText({
  model,
  messages: [{ role: "user", content: "Hello!" }],
})

for await (const delta of result.textStream) {
  process.stdout.write(delta)
}

// ============================================================================
// Dynamic Model Selection
// ============================================================================

// Select model based on task complexity
async function selectModel(taskComplexity: "simple" | "complex"): Promise<string> {
  const models = {
    simple: "anthropic:claude-haiku-4-20250311",
    complex: "anthropic:claude-sonnet-4-20250514",
  }
  return models[taskComplexity]
}

const taskModel = await ProviderRegistry.get(await selectModel("complex"))

// ============================================================================
// Error Handling
// ============================================================================

try {
  await ProviderRegistry.get("invalid-provider:some-model")
} catch (error) {
  console.error("Invalid provider:", error)
}

try {
  ProviderRegistry.parse("invalid-format-no-colon")
} catch (error) {
  console.error("Invalid format:", error)
}

// ============================================================================
// Benefits
// ============================================================================

// 1. More concise API:
//    - Before: Provider.getLanguage(await Provider.getModel(provider, model))
//    - After:  ProviderRegistry.get("provider:model")
//
// 2. Easier to store model references:
//    - Can store as single string: "anthropic:claude-sonnet-4-20250514"
//    - Instead of: { providerID: "anthropic", modelID: "claude-sonnet-4-20250514" }
//
// 3. Simpler configuration:
//    - User config can use: { model: "anthropic:claude-sonnet-4-20250514" }
//    - Instead of: { provider: "anthropic", model: "claude-sonnet-4-20250514" }
//
// 4. Backward compatible:
//    - Existing code using Provider.getModel() continues to work
//    - Models are cached in the same Provider layer
//    - No performance overhead

// ============================================================================
// When to Use
// ============================================================================

// Use ProviderRegistry when:
// - Building new features that need model selection
// - Working with user-facing configuration
// - Creating tools that accept model parameters
// - Simplifying API signatures

// Use Provider.getModel() when:
// - You already have separate providerID and modelID variables
// - Working with existing codebase that uses the old pattern
// - Need access to Provider.Model metadata (not just LanguageModelV3)
