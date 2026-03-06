import { test, expect } from "bun:test"
import { ProviderRegistry } from "@/provider/registry"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { Env } from "@/env"
import path from "path"
import { tmpdir } from "../fixture/fixture"

test("ProviderRegistry.parse() parses namespace format correctly", () => {
  const result = ProviderRegistry.parse("anthropic:claude-sonnet-4.5")
  expect(result.providerID).toBe("anthropic")
  expect(result.modelID).toBe("claude-sonnet-4.5")
})

test("ProviderRegistry.parse() handles model IDs with slashes", () => {
  const result = ProviderRegistry.parse("openrouter:anthropic/claude-3-opus")
  expect(result.providerID).toBe("openrouter")
  expect(result.modelID).toBe("anthropic/claude-3-opus")
})

test("ProviderRegistry.parse() throws on invalid format", () => {
  expect(() => ProviderRegistry.parse("invalid-no-colon")).toThrow()
  expect(() => ProviderRegistry.parse(":empty-provider")).toThrow()
  expect(() => ProviderRegistry.parse("empty-model:")).toThrow()
})

test("ProviderRegistry.format() creates namespace format", () => {
  const result = ProviderRegistry.format("anthropic", "claude-sonnet-4.5")
  expect(result).toBe("anthropic:claude-sonnet-4.5")
})

test("ProviderRegistry.format() handles model IDs with slashes", () => {
  const result = ProviderRegistry.format("openrouter", "anthropic/claude-3-opus")
  expect(result).toBe("openrouter:anthropic/claude-3-opus")
})

test("ProviderRegistry.get() retrieves language model", async () => {
  await using tmp = await tmpdir({
    init: async (dir: string) => {
      await Bun.write(
        path.join(dir, "ironcode.json"),
        JSON.stringify({
          $schema: "https://ironcode.cloud/config.json",
        }),
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("ANTHROPIC_API_KEY", "test-api-key")
    },
    fn: async () => {
      // Get model using registry
      const language = await ProviderRegistry.get("anthropic:claude-sonnet-4-20250514")
      expect(language).toBeDefined()

      // Verify it's the same as using Provider directly
      const model = await Provider.getModel("anthropic", "claude-sonnet-4-20250514")
      const directLanguage = await Provider.getLanguage(model)
      expect(language).toBe(directLanguage) // Should be same cached instance
    },
  })
})

test("ProviderRegistry.list() returns all available models", async () => {
  await using tmp = await tmpdir({
    init: async (dir: string) => {
      await Bun.write(
        path.join(dir, "ironcode.json"),
        JSON.stringify({
          $schema: "https://ironcode.cloud/config.json",
        }),
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("ANTHROPIC_API_KEY", "test-api-key")
    },
    fn: async () => {
      const models = await ProviderRegistry.list()

      expect(models.length).toBeGreaterThan(0)
      expect(models).toContain("anthropic:claude-sonnet-4-20250514")

      // Verify all models follow namespace format
      for (const model of models) {
        expect(model).toMatch(/^[^:]+:[^:]+/)
      }
    },
  })
})

test("ProviderRegistry.get() throws on invalid provider", async () => {
  await using tmp = await tmpdir({
    init: async (dir: string) => {
      await Bun.write(
        path.join(dir, "ironcode.json"),
        JSON.stringify({
          $schema: "https://ironcode.cloud/config.json",
        }),
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await expect(ProviderRegistry.get("invalid-provider:some-model")).rejects.toThrow()
    },
  })
})

test("ProviderRegistry.get() throws on invalid model", async () => {
  await using tmp = await tmpdir({
    init: async (dir: string) => {
      await Bun.write(
        path.join(dir, "ironcode.json"),
        JSON.stringify({
          $schema: "https://ironcode.cloud/config.json",
        }),
      )
    },
  })

  await Instance.provide({
    directory: tmp.path,
    init: async () => {
      Env.set("ANTHROPIC_API_KEY", "test-api-key")
    },
    fn: async () => {
      await expect(ProviderRegistry.get("anthropic:nonexistent-model")).rejects.toThrow()
    },
  })
})
