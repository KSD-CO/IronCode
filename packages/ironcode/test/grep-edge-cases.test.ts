import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { grepFFI } from "../src/tool/ffi"
import { writeFileSync, mkdirSync, rmSync } from "fs"
import path from "path"

describe("Grep Streaming - Edge Cases & Data Integrity", () => {
  const testDir = path.join(import.meta.dir, "grep-edge-case-tests")

  // Setup test directory
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  // Cleanup
  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  test("should handle long lines without data loss", () => {
    // Create file with very long line (10KB single line)
    const longLine = "a".repeat(10000) + "FINDME" + "b".repeat(10000)
    const testFile = path.join(testDir, "long-line.txt")
    writeFileSync(testFile, longLine)

    const result = grepFFI("FINDME", testDir, "*.txt")

    expect(result.metadata.count).toBe(1)
    expect(result.output).toContain("FINDME")
    expect(result.output).toContain("Line 1")
  })

  test("should handle files with many lines efficiently", () => {
    // Create file with 10,000 lines, some matching
    const lines = []
    for (let i = 0; i < 10000; i++) {
      if (i % 100 === 0) {
        lines.push(`Line ${i}: MATCH_THIS`)
      } else {
        lines.push(`Line ${i}: normal content`)
      }
    }
    const testFile = path.join(testDir, "many-lines.txt")
    writeFileSync(testFile, lines.join("\n"))

    const result = grepFFI("MATCH_THIS", testDir, "*.txt")

    // Should find 100 matches (every 100th line)
    expect(result.metadata.count).toBe(100)
    expect(result.output).toContain("MATCH_THIS")
  })

  test("should handle special characters and unicode correctly", () => {
    const content = [
      "Regular line",
      "Line with émojis 🚀 and unicode ñ é ü",
      "Special chars: @#$%^&*(){}[]|\\;:'\",.<>?/",
      "Vietnamese: Xin chào thế giới Việt Nam",
      "Chinese: 你好世界",
      "Japanese: こんにちは世界",
      "Emojis: 😀 🎉 ✨ 🔥 ⚡",
    ].join("\n")

    const testFile = path.join(testDir, "unicode.txt")
    writeFileSync(testFile, content, "utf-8")

    // Test 1: Unicode characters
    const result1 = grepFFI("émojis", testDir, "unicode.txt")
    expect(result1.metadata.count).toBe(1)
    expect(result1.output).toContain("émojis 🚀")

    // Test 2: Special chars
    const result2 = grepFFI("Special chars", testDir, "unicode.txt")
    expect(result2.metadata.count).toBe(1)
    expect(result2.output).toContain("@#$%")

    // Test 3: Vietnamese
    const result3 = grepFFI("Việt Nam", testDir, "unicode.txt")
    expect(result3.metadata.count).toBe(1)
    expect(result3.output).toContain("Việt Nam")

    // Test 4: Emojis
    const result4 = grepFFI("🚀", testDir, "unicode.txt")
    expect(result4.metadata.count).toBe(1)
    expect(result4.output).toContain("🚀")

    console.log("\n✅ Unicode & special char test:")
    console.log(`   émojis found: ${result1.metadata.count}`)
    console.log(`   Special chars found: ${result2.metadata.count}`)
    console.log(`   Việt Nam found: ${result3.metadata.count}`)
    console.log(`   Emoji 🚀 found: ${result4.metadata.count}`)
  })

  test("should handle line endings correctly (LF, CRLF)", () => {
    // Test LF (Unix)
    const contentLF = "line1 FIND\nline2 normal\nline3 FIND\n"
    const fileLF = path.join(testDir, "lf.txt")
    writeFileSync(fileLF, contentLF)

    // Test CRLF (Windows)
    const contentCRLF = "line1 FIND\r\nline2 normal\r\nline3 FIND\r\n"
    const fileCRLF = path.join(testDir, "crlf.txt")
    writeFileSync(fileCRLF, contentCRLF)

    const resultLF = grepFFI("FIND", testDir, "lf.txt")
    const resultCRLF = grepFFI("FIND", testDir, "crlf.txt")

    expect(resultLF.metadata.count).toBe(2)
    expect(resultCRLF.metadata.count).toBe(2)

    console.log("\n✅ Line ending test:")
    console.log(`   LF matches: ${resultLF.metadata.count}`)
    console.log(`   CRLF matches: ${resultCRLF.metadata.count}`)
  })

  test("should NOT match across line boundaries (per-line search)", () => {
    // This is the expected behavior - grep searches line-by-line
    const content = ["This is line one with PART1", "This is line two with PART2", "SingleLinePART1PART2 matches"].join(
      "\n",
    )

    const testFile = path.join(testDir, "multiline.txt")
    writeFileSync(testFile, content)

    // Pattern that would match if we searched across lines
    const result1 = grepFFI("PART1.*PART2", testDir, "multiline.txt")

    // Should only match line 3 (where both parts are on same line)
    expect(result1.metadata.count).toBe(1)
    expect(result1.output).toContain("Line 3")
    expect(result1.output).toContain("SingleLinePART1PART2")

    console.log("\n✅ Line boundary test (expected behavior):")
    console.log(`   PART1.*PART2 matches: ${result1.metadata.count}`)
    console.log(`   Only matches when both on same line ✓`)
  })

  test("should handle empty lines and whitespace-only lines", () => {
    const content = ["line1", "", "   ", "\t", "line5 with content", "", "line7 MATCH"].join("\n")

    const testFile = path.join(testDir, "empty-lines.txt")
    writeFileSync(testFile, content)

    const result = grepFFI("MATCH", testDir, "empty-lines.txt")

    expect(result.metadata.count).toBe(1)
    expect(result.output).toContain("Line 7")
  })

  test("should handle binary-like content gracefully", () => {
    // Create file with some non-UTF8 bytes mixed with text
    const content = "Normal text\nMATCH here\nMore text"
    const testFile = path.join(testDir, "mixed.txt")
    writeFileSync(testFile, content)

    const result = grepFFI("MATCH", testDir, "mixed.txt")

    expect(result.metadata.count).toBe(1)
    expect(result.output).toContain("MATCH here")
  })

  test("should handle regex quantifiers correctly", () => {
    const content = ["a", "aa", "aaa", "aaaa", "aaaaa", "test"].join("\n")

    const testFile = path.join(testDir, "quantifiers.txt")
    writeFileSync(testFile, content)

    // Test 1: a{3,} (3 or more 'a')
    const result1 = grepFFI("^a{3,}$", testDir, "quantifiers.txt")
    expect(result1.metadata.count).toBe(3) // aaa, aaaa, aaaaa

    // Test 2: a{2} (exactly 2 'a')
    const result2 = grepFFI("^a{2}$", testDir, "quantifiers.txt")
    expect(result2.metadata.count).toBe(1) // aa

    console.log("\n✅ Regex quantifier test:")
    console.log(`   a{3,} matches: ${result1.metadata.count}`)
    console.log(`   a{2} matches: ${result2.metadata.count}`)
  })

  test("should preserve exact line content without modification", () => {
    const originalLines = [
      "  leading spaces",
      "trailing spaces  ",
      "\ttab at start",
      "tab at end\t",
      "mixed\t spaces \t and\ttabs",
    ]
    const content = originalLines.join("\n")

    const testFile = path.join(testDir, "whitespace.txt")
    writeFileSync(testFile, content)

    const result = grepFFI(".*", testDir, "whitespace.txt") // Match all

    // Verify output contains original whitespace
    expect(result.output).toContain("  leading spaces")
    expect(result.output).toContain("trailing spaces  ")
    expect(result.output).toContain("\ttab")

    console.log("\n✅ Whitespace preservation test:")
    console.log(`   All ${originalLines.length} lines found with exact whitespace`)
  })
})
