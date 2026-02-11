import { describe, test } from "bun:test"

describe("Optimization analysis", () => {
  test("compare memory: CLI only vs CLI + Server", async () => {
    console.log("\n" + "=".repeat(70))
    console.log("MEMORY OPTIMIZATION ANALYSIS")
    console.log("=".repeat(70))

    // Baseline
    const baseline = process.memoryUsage()

    // Import session logic (what we need)
    const { Session } = await import("../src/session/index.ts")
    const { SessionPrompt } = await import("../src/session/prompt.ts")

    const withSession = process.memoryUsage()
    const sessionCost = (withSession.heapUsed - baseline.heapUsed) / 1024 / 1024

    console.log(`\n1. DIRECT APPROACH (what we need):`)
    console.log(`   Import Session + SessionPrompt: ${sessionCost.toFixed(2)}MB`)

    // Import server (what we currently do)
    const { Server } = await import("../src/server/server.ts")
    const app = Server.App()

    const withServer = process.memoryUsage()
    const serverCost = (withServer.heapUsed - withSession.heapUsed) / 1024 / 1024

    console.log(`\n2. CURRENT APPROACH (HTTP layer):`)
    console.log(`   Import Server + all routes: ${serverCost.toFixed(2)}MB`)

    console.log(`\n3. SAVINGS IF WE REMOVE HTTP LAYER:`)
    console.log(`   Memory saved: ${serverCost.toFixed(2)}MB`)
    console.log(`   Percentage: ${((serverCost / (sessionCost + serverCost)) * 100).toFixed(1)}% of total`)

    console.log(`\n4. IMPACT ON 300MB MEMORY LIMIT:`)
    const currentLimit = 300
    console.log(`   Current: ~${currentLimit}MB limit`)
    console.log(`   HTTP overhead: ${serverCost.toFixed(2)}MB`)
    console.log(`   Percentage of limit: ${((serverCost / currentLimit) * 100).toFixed(1)}%`)
    console.log(`   Savings: ~${((serverCost / 240) * 100).toFixed(1)}% more headroom for AI work`)

    console.log("\n" + "=".repeat(70))
  })
})
