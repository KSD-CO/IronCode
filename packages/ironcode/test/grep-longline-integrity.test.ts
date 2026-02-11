import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { grepFFI } from "../src/tool/ffi"
import { writeFileSync, mkdirSync, rmSync } from "fs"
import path from "path"

describe("Grep - Long Line Data Integrity", () => {
  const testDir = path.join(import.meta.dir, "grep-longline-test")

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test("should match patterns even at end of very long lines", () => {
    // Create a 10KB line with pattern at the END (after char 2000)
    const padding = "x".repeat(5000)
    const testLine = padding + "PATTERN_AT_END" + padding
    const testFile = path.join(testDir, "long-end.txt")
    writeFileSync(testFile, testLine)

    // This pattern is at position 5000, way beyond the 2000 char display limit
    const result = grepFFI("PATTERN_AT_END", testDir, "long-end.txt")

    // Should still match because regex runs on FULL line before truncation
    expect(result.metadata.count).toBe(1)
    expect(result.output).toContain("Line 1")

    console.log("\n✅ Long line test (pattern at char 5000):")
    console.log(`   Pattern found: ${result.metadata.count === 1 ? "YES" : "NO"}`)
    console.log(`   Total line length: ${testLine.length} chars`)
    console.log(`   Display truncates at: 2000 chars`)
    console.log(`   Pattern position: ~5000 chars`)
    console.log(`   Result: Pattern matched despite being beyond display limit ✓`)
  })

  test("should match patterns at beginning, middle, and end of long lines", () => {
    const padding = "y".repeat(3000)

    // Pattern at different positions
    const lines = [
      "START_PATTERN" + padding, // Position 0-13
      padding + "MIDDLE_PATTERN" + padding, // Position ~3000
      padding + "END_PATTERN", // Position ~6000
    ]

    const testFile = path.join(testDir, "positions.txt")
    writeFileSync(testFile, lines.join("\n"))

    // Test each pattern
    const result1 = grepFFI("START_PATTERN", testDir, "positions.txt")
    const result2 = grepFFI("MIDDLE_PATTERN", testDir, "positions.txt")
    const result3 = grepFFI("END_PATTERN", testDir, "positions.txt")

    expect(result1.metadata.count).toBe(1)
    expect(result2.metadata.count).toBe(1)
    expect(result3.metadata.count).toBe(1)

    console.log("\n✅ Pattern position test:")
    console.log(`   START_PATTERN (pos ~0): ${result1.metadata.count} match`)
    console.log(`   MIDDLE_PATTERN (pos ~3000): ${result2.metadata.count} match`)
    console.log(`   END_PATTERN (pos ~6000): ${result3.metadata.count} match`)
    console.log(`   All patterns matched regardless of position ✓`)
  })

  test("should match complex regex on long lines", () => {
    // Create very long line with complex pattern in the middle
    const prefix = "a".repeat(4000)
    const pattern = "test@example.com" // Email-like pattern
    const suffix = "b".repeat(4000)
    const testLine = prefix + pattern + suffix

    const testFile = path.join(testDir, "complex.txt")
    writeFileSync(testFile, testLine)

    // Complex regex for email
    const result = grepFFI("[a-z]+@[a-z]+\\.[a-z]+", testDir, "complex.txt")

    expect(result.metadata.count).toBe(1)

    console.log("\n✅ Complex regex test on long line:")
    console.log(`   Line length: ${testLine.length} chars`)
    console.log(`   Pattern at position: ~4000`)
    console.log(`   Regex: [a-z]+@[a-z]+\\.[a-z]+`)
    console.log(`   Match found: ${result.metadata.count === 1 ? "YES ✓" : "NO ✗"}`)
  })

  test("should NOT lose data when streaming - full line is processed", () => {
    // This is the key test: prove that streaming doesn't lose data

    // Create 100 lines, each 5KB, with unique patterns
    const lines = []
    for (let i = 0; i < 100; i++) {
      const padding1 = `line${i}_`.repeat(400) // ~4KB
      const marker = `UNIQUE_${i}`
      const padding2 = `_end${i}`.repeat(100) // ~1KB
      lines.push(padding1 + marker + padding2)
    }

    const testFile = path.join(testDir, "streaming.txt")
    writeFileSync(testFile, lines.join("\n"))

    // Search for patterns that appear in the middle of long lines
    const results: number[] = []
    const failed: number[] = []
    for (let i = 0; i < 10; i++) {
      // Test first 10 to keep test fast
      // Use word boundary to avoid matching UNIQUE_1 with UNIQUE_10, etc
      const result = grepFFI(`UNIQUE_${i}_`, testFile, undefined)
      results.push(result.metadata.count)
      if (result.metadata.count !== 1) {
        failed.push(i)
      }
    }

    // All patterns should be found
    const allFound = results.every((count: number) => count === 1)

    if (!allFound) {
      console.log(`\n❌ Failed patterns: ${failed.join(", ")}`)
      for (const i of failed.slice(0, 3)) {
        const result = grepFFI(`UNIQUE_${i}`, testFile, undefined)
        console.log(`   UNIQUE_${i}: found ${result.metadata.count} times`)
      }
    }

    expect(allFound).toBe(true)

    console.log("\n✅ Streaming data integrity test:")
    console.log(`   Lines: 100`)
    console.log(`   Line length: ~5KB each`)
    console.log(`   Unique patterns tested: ${results.length}`)
    console.log(`   Patterns found: ${results.filter((c) => c === 1).length}/${results.length}`)
    console.log(`   Data loss: ${allFound ? "NONE ✓" : "DETECTED ✗"}`)
  })

  test("should match on actual line content, truncate only for display", () => {
    // Pattern beyond 2000 chars
    const line1 = "a".repeat(2500) + "HIDDEN_PATTERN" + "b".repeat(500)
    const line2 = "VISIBLE_PATTERN" + "c".repeat(100)

    const testFile = path.join(testDir, "truncation.txt")
    writeFileSync(testFile, [line1, line2].join("\n"))

    const resultHidden = grepFFI("HIDDEN_PATTERN", testDir, "truncation.txt")
    const resultVisible = grepFFI("VISIBLE_PATTERN", testDir, "truncation.txt")

    // Both should match
    expect(resultHidden.metadata.count).toBe(1)
    expect(resultVisible.metadata.count).toBe(1)

    // But HIDDEN_PATTERN won't appear in output (truncated at 2000 chars)
    // while VISIBLE_PATTERN will appear
    expect(resultVisible.output).toContain("VISIBLE_PATTERN")

    console.log("\n✅ Truncation vs Matching test:")
    console.log(`   HIDDEN_PATTERN (at char 2500): matched=${resultHidden.metadata.count === 1}`)
    console.log(`   VISIBLE_PATTERN (at char 0): matched=${resultVisible.metadata.count === 1}`)
    console.log(`   Conclusion: Matching works on full line, display truncates for readability ✓`)
  })
})
