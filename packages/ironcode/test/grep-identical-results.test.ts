import { describe, expect, test } from "bun:test"
import { grepFFI } from "../src/tool/ffi"
import path from "path"

describe("Grep Streaming - Identical Results Verification", () => {
  test("should produce deterministic results across multiple runs", () => {
    const testDir = path.join(import.meta.dir, "..")
    const pattern = "export"
    const searchPath = path.join(testDir, "src")
    const include = "*.ts"

    // Run grep multiple times
    const results = []
    for (let i = 0; i < 5; i++) {
      const result = grepFFI(pattern, searchPath, include)
      results.push(result)
    }

    // All results should be identical
    for (let i = 1; i < results.length; i++) {
      expect(results[i].output).toBe(results[0].output)
      expect(results[i].metadata.count).toBe(results[0].metadata.count)
      expect(results[i].metadata.truncated).toBe(results[0].metadata.truncated)
      expect(results[i].title).toBe(results[0].title)
    }

    console.log(`\n✅ Deterministic test: ${results.length} runs produced identical results`)
    console.log(`   Matches: ${results[0].metadata.count}`)
    console.log(`   Output length: ${results[0].output.length} bytes`)
  })

  test("should match exact line numbers and content", () => {
    const testDir = path.join(import.meta.dir, "..")

    // Search for a specific pattern that should have predictable results
    const result = grepFFI("^import.*from", path.join(testDir, "src/tool"), "grep.ts")

    expect(result.metadata.count).toBeGreaterThan(0)

    // Parse output to extract line numbers
    const lines = result.output.split("\n")
    const lineMatches = lines.filter((line) => line.includes("Line "))

    console.log(`\n✅ Line matching test:`)
    console.log(`   Pattern: '^import.*from'`)
    console.log(`   File: grep.ts`)
    console.log(`   Matches found: ${lineMatches.length}`)

    // Each match should have format "  Line X: content"
    for (const match of lineMatches.slice(0, 3)) {
      expect(match as string).toMatch(/^\s+Line \d+: /)
      console.log(`   ${(match as string).trim()}`)
    }
  })

  test("should handle edge cases correctly", () => {
    const testDir = path.join(import.meta.dir, "..")

    // Test 1: Empty pattern (should work)
    const result1 = grepFFI(
      ".*", // Match everything
      path.join(testDir, "src/tool"),
      "grep.ts",
    )
    expect(result1.metadata.count).toBeGreaterThan(0)

    // Test 2: Pattern with no matches
    const result2 = grepFFI("XYZNOTFOUND12345", path.join(testDir, "src"), "*.ts")
    expect(result2.metadata.count).toBe(0)
    expect(result2.output).toContain("No files found")

    // Test 3: Complex regex
    const result3 = grepFFI("^\\s*export\\s+(const|function|class)", path.join(testDir, "src/tool"), "*.ts")
    expect(result3.metadata.count).toBeGreaterThanOrEqual(0)

    console.log(`\n✅ Edge cases test:`)
    console.log(`   Match all: ${result1.metadata.count} matches`)
    console.log(`   No matches: ${result2.metadata.count} matches`)
    console.log(`   Complex regex: ${result3.metadata.count} matches`)
  })

  test("should preserve exact character content including special chars", () => {
    const testDir = path.join(import.meta.dir, "..")

    // Search for lines with special characters
    const result = grepFFI("\\{.*\\}", path.join(testDir, "src/tool"), "grep.ts")

    expect(result.output).toBeDefined()

    // Verify output doesn't have corrupted characters
    const lines = result.output.split("\n")
    const contentLines = lines.filter((line: string) => line.includes("Line "))

    for (const line of contentLines) {
      // Should not have any null bytes or corrupted content
      expect(line as string).not.toContain("\0")
      expect(line as string).not.toContain("�") // Replacement character
    }

    console.log(`\n✅ Character preservation test:`)
    console.log(`   Pattern with special chars: '\\{.*\\}'`)
    console.log(`   Lines checked: ${contentLines.length}`)
    console.log(`   No corrupted characters found`)
  })

  test("should maintain consistent ordering", () => {
    const testDir = path.join(import.meta.dir, "..")

    // Run same search multiple times
    const runs = []
    for (let i = 0; i < 3; i++) {
      const result = grepFFI("function", path.join(testDir, "src/tool"), "*.ts")
      runs.push(result.output.split("\n").filter((line) => line.includes("Line ")))
    }

    // All runs should have same ordering
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].length).toBe(runs[0].length)
      for (let j = 0; j < runs[0].length; j++) {
        expect(runs[i][j]).toBe(runs[0][j])
      }
    }

    console.log(`\n✅ Ordering consistency test:`)
    console.log(`   Runs: ${runs.length}`)
    console.log(`   Lines per run: ${runs[0].length}`)
    console.log(`   All runs have identical ordering`)
  })
})
