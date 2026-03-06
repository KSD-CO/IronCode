import { Session } from "./src/session/index.ts"
import { SessionPrompt } from "./src/session/prompt.ts"
import { Instance } from "./src/project/instance.ts"

await Instance.provide({
  directory: process.cwd(),
  fn: async () => {
    try {
      console.log("Creating session...")
      const session = await Session.create({ agent: "general", title: "test" })
      console.log("✅ Session:", session.id)

      console.log("\nSending prompt...")
      await SessionPrompt.prompt({
        sessionID: session.id,
        parts: [{ type: "text", text: "hello" }],
      })
      console.log("✅ Prompt sent")

      console.log("\nFetching messages...")
      const messages = await Session.messages({ sessionID: session.id })
      console.log("✅ Message count:", messages.length)

      for (const msg of messages) {
        console.log(`  ${msg.info.role}: model=${msg.info.model}`)
      }
    } catch (err: any) {
      console.error("\n❌ ERROR:", err.message)
      console.error(err.stack)
      process.exit(1)
    }
  },
})
