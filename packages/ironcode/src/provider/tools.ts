import type { Tool } from "ai"
import type { Provider } from "./provider"

// Lazy-loaded provider tool factories
// Each provider SDK is only imported when its tools are actually requested,
// avoiding ~20-100MB of unused SDK memory overhead.

type ProviderToolEntry = {
  sdk: string
  tools: Record<string, () => Promise<Tool>>
}

const PROVIDER_TOOLS: Record<string, ProviderToolEntry> = {
  anthropic: {
    sdk: "@ai-sdk/anthropic",
    tools: {
      web_search: async () => (await import("@ai-sdk/anthropic")).anthropic.tools.webSearch_20250305(),
      web_fetch: async () => (await import("@ai-sdk/anthropic")).anthropic.tools.webFetch_20250910(),
      code_execution: async () => (await import("@ai-sdk/anthropic")).anthropic.tools.codeExecution_20250522(),
    },
  },
  openai: {
    sdk: "@ai-sdk/openai",
    tools: {
      web_search: async () => (await import("@ai-sdk/openai")).openai.tools.webSearch(),
      code_interpreter: async () => (await import("@ai-sdk/openai")).openai.tools.codeInterpreter(),
      image_generation: async () => (await import("@ai-sdk/openai")).openai.tools.imageGeneration(),
    },
  },
  google: {
    sdk: "@ai-sdk/google",
    tools: {
      google_search: async () => (await import("@ai-sdk/google")).google.tools.googleSearch({}),
      code_execution: async () => (await import("@ai-sdk/google")).google.tools.codeExecution({}),
      url_context: async () => (await import("@ai-sdk/google")).google.tools.urlContext({}),
    },
  },
  xai: {
    sdk: "@ai-sdk/xai",
    tools: {
      web_search: async () => (await import("@ai-sdk/xai")).xai.tools.webSearch({}),
      x_search: async () => (await import("@ai-sdk/xai")).xai.tools.xSearch({}),
      code_execution: async () => (await import("@ai-sdk/xai")).xai.tools.codeExecution({}),
    },
  },
  "github-copilot": {
    sdk: "@ai-sdk/github-copilot",
    tools: {
      web_search: async () => (await import("./sdk/copilot/responses/tool/web-search")).webSearch(),
      local_shell: async () => (await import("./sdk/copilot/responses/tool/local-shell")).localShell({}),
      code_interpreter: async () => (await import("./sdk/copilot/responses/tool/code-interpreter")).codeInterpreter(),
      file_search: async () =>
        (await import("./sdk/copilot/responses/tool/file-search")).fileSearch({ vectorStoreIds: [] }),
      image_generation: async () => (await import("./sdk/copilot/responses/tool/image-generation")).imageGeneration(),
    },
  },
}

/**
 * Resolve provider-specific tools based on config and current model.
 *
 * Config format: ["anthropic:web_search", "openai:*", "google:google_search"]
 * - "provider:tool_name" enables a specific tool
 * - "provider:*" enables all tools for that provider
 *
 * Tools are only added if the current model uses the matching provider SDK.
 * Provider SDKs are lazy-loaded to avoid loading unused SDKs into memory.
 */
export async function resolveProviderTools(
  model: Provider.Model,
  enabledTools: string[],
): Promise<Record<string, Tool>> {
  const result: Record<string, Tool> = {}

  for (const entry of enabledTools) {
    const [providerKey, toolName] = entry.split(":")
    if (!providerKey || !toolName) continue

    const provider = PROVIDER_TOOLS[providerKey]
    if (!provider) continue

    // Only add tools if the current model uses this provider's SDK
    if (model.api.npm !== provider.sdk) continue

    if (toolName === "*") {
      // Enable all tools for this provider
      for (const [name, factory] of Object.entries(provider.tools)) {
        result[`${providerKey}_${name}`] = await factory()
      }
    } else if (provider.tools[toolName]) {
      result[`${providerKey}_${toolName}`] = await provider.tools[toolName]()
    }
  }

  return result
}
