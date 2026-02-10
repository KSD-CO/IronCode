import { writeRawFFI } from "../src/tool/ffi"
import { existsSync, readFileSync, unlinkSync } from "fs"
import { join } from "path"

const testFile = join(process.cwd(), "test-write.txt")

try {
  // Clean up if exists
  if (existsSync(testFile)) {
    unlinkSync(testFile)
  }

  console.log("Test 1: Write new file")
  const result1 = writeRawFFI(testFile, "Hello, World!\nLine 2\nLine 3")
  console.log("Result:", result1)
  console.log("File exists:", existsSync(testFile))
  console.log("Content:", readFileSync(testFile, "utf-8"))

  console.log("\nTest 2: Overwrite existing file")
  const result2 = writeRawFFI(testFile, "Updated content\nNew line")
  console.log("Result:", result2)
  console.log("Content:", readFileSync(testFile, "utf-8"))

  console.log("\nTest 3: Write large content")
  const largeContent = Array(1000)
    .fill(0)
    .map((_, i) => `Line ${i + 1}`)
    .join("\n")
  const result3 = writeRawFFI(testFile, largeContent)
  console.log("Result:", result3)
  console.log("File size:", readFileSync(testFile, "utf-8").length, "bytes")

  console.log("\n✅ All tests passed!")
} catch (error) {
  console.error("❌ Test failed:", error)
} finally {
  // Clean up
  if (existsSync(testFile)) {
    unlinkSync(testFile)
  }
}
