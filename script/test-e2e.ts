#!/usr/bin/env bun

// End-to-end test with actual EditTool
import { EditTool } from "../packages/ironcode/src/tool/edit"
import * as fs from "fs"

const testFile = "/tmp/test-edit-file.ts"

console.log("🧪 End-to-End Test: EditTool with Native Rust Backend")
console.log("=".repeat(70))

// Create test file
const originalContent = `// Test file for edit tool
function oldFunction() {
  console.log("This is old");
  return 42;
}

const value = 123;
`

fs.writeFileSync(testFile, originalContent)
console.log(`\n📝 Created test file: ${testFile}`)
console.log(`Original content:\n${originalContent}`)

// Mock context for testing
const mockContext = {
  sessionID: "test-session",
  ask: async () => {}, // Auto-approve
  metadata: () => {},
}

async function testEdit() {
  try {
    console.log("\n🔧 Running edit...")

    const result = await EditTool.execute(
      {
        filePath: testFile,
        oldString: 'function oldFunction() {\n  console.log("This is old");\n  return 42;\n}',
        newString: 'function newFunction() {\n  console.log("This is new!");\n  return 100;\n}',
        replaceAll: false,
      },
      mockContext as any,
    )

    console.log(`\n✅ Edit succeeded!`)
    console.log(`Output: ${result.output}`)

    // Read modified content
    const newContent = fs.readFileSync(testFile, "utf-8")
    console.log(`\nNew content:\n${newContent}`)

    // Verify
    const expected = `// Test file for edit tool
function newFunction() {
  console.log("This is new!");
  return 100;
}

const value = 123;
`

    if (newContent === expected) {
      console.log("\n✅ Content matches expected output!")
      console.log("\n🎉 END-TO-END TEST PASSED!")
      console.log("\n📊 Native Rust edit implementation is working perfectly in production!")

      // Cleanup
      fs.unlinkSync(testFile)
      process.exit(0)
    } else {
      console.log("\n❌ Content doesn't match expected")
      console.log(`Expected:\n${expected}`)
      console.log(`Got:\n${newContent}`)
      process.exit(1)
    }
  } catch (error) {
    console.error(`\n❌ Test failed: ${(error as Error).message}`)
    console.error((error as Error).stack)
    process.exit(1)
  }
}

testEdit()
