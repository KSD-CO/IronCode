import { Session } from "./packages/ironcode/src/session/index.ts"
import { Agent } from "./packages/ironcode/src/agent/agent.ts"
import { Instance } from "./packages/ironcode/src/project/instance.ts"

await Instance.provide({
  directory: "./packages/ironcode",
  fn: async () => {
    try {
      console.log("=== Loading agent ===")
      const agent = await Agent.get("general")
      console.log("Agent:", agent.name, "model:", agent.model, "type:", typeof agent.model)

      console.log("\n=== Creating session ===")
      const session = await Session.create({ agent: "general", title: "test" })
      console.log("✅ SUCCESS! Session:", session.id)
    } catch (err: any) {
      console.error("\n❌ ERROR:", err.message)
      console.error("Stack:", err.stack)
      process.exit(1)
    }
  },
})
