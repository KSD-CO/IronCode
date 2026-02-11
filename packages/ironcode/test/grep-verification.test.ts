import { describe, expect, test } from "bun:test"
import { grepFFI } from "../src/tool/ffi"
import path from "path"

describe("Grep Streaming Verification", () => {
  test("should return consistent results with streaming", async () => {
    const testDir = path.join(import.meta.dir, "..")

    // Test case 1: Search for 'export' in src directory
    const result1 = grepFFI("export", path.join(testDir, "src"), "*.ts")

    expect(result1.output).toBeDefined()
    expect(result1.metadata.count).toBeGreaterThan(0)

    // Test case 2: Search for 'import' statements
    const result2 = grepFFI("^import", path.join(testDir, "src"), "*.ts")

    expect(result2.output).toBeDefined()
    expect(result2.metadata.count).toBeGreaterThan(0)

    // Test case 3: No matches
    const result3 = grepFFI("XYZABC123NOTFOUND", path.join(testDir, "src"), undefined)

    expect(result3.output).toContain("No files found")
    expect(result3.metadata.count).toBe(0)
  })

  test("should handle large files efficiently", async () => {
    const testDir = path.join(import.meta.dir, "..")

    // Search in entire codebase
    const startTime = performance.now()
    const result = grepFFI("function", testDir, "*.ts")
    const endTime = performance.now()

    const duration = endTime - startTime

    console.log(`\nGrep performance test:`)
    console.log(`  Pattern: 'function'`)
    console.log(`  Matches: ${result.metadata.count}`)
    console.log(`  Duration: ${duration.toFixed(2)}ms`)
    console.log(`  Truncated: ${result.metadata.truncated}`)

    expect(result.output).toBeDefined()
    expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
  })

  test("should handle special characters in pattern", async () => {
    const testDir = path.join(import.meta.dir, "..")

    // Search for regex pattern with special chars
    const result = grepFFI("\\{.*\\}", path.join(testDir, "src/tool"), "*.ts")

    expect(result.output).toBeDefined()
  })

  test("should return results in consistent format", async () => {
    const testDir = path.join(import.meta.dir, "..")

    const result = grepFFI("describe", path.join(testDir, "test"), "*.test.ts")

    expect(result.title).toBe("describe")
    expect(result.metadata).toHaveProperty("count")
    expect(result.metadata).toHaveProperty("truncated")
    expect(typeof result.output).toBe("string")

    if (result.metadata.count > 0) {
      expect(result.output).toContain("Line ")
      expect(result.output).toContain(":")
    }
  })
})
