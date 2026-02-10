import { describe, test } from "bun:test"

describe("Server memory footprint", () => {
  test("measure server import cost", async () => {
    const before = process.memoryUsage()

    // Import server
    const { Server } = await import("../src/server/server")

    const afterImport = process.memoryUsage()

    // Initialize app
    const app = Server.App()

    const afterInit = process.memoryUsage()

    console.log("\n" + "=".repeat(60))
    console.log("Server Memory Footprint Analysis")
    console.log("=".repeat(60))
    console.log(`Import cost: ${((afterImport.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2)}MB`)
    console.log(`Init cost: ${((afterInit.heapUsed - afterImport.heapUsed) / 1024 / 1024).toFixed(2)}MB`)
    console.log(`Total cost: ${((afterInit.heapUsed - before.heapUsed) / 1024 / 1024).toFixed(2)}MB`)
    console.log("")
    console.log("This memory is used for:")
    console.log("  - Hono framework")
    console.log("  - All route handlers (~30 routes)")
    console.log("  - Middleware (CORS, auth, logging, SSE)")
    console.log("  - OpenAPI spec generation")
    console.log("  - SDK type definitions")
    console.log("=".repeat(60))
  })
})
