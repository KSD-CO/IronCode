#!/usr/bin/env bun

// Test that integrated edit tool works correctly
import { editReplaceFFI } from "../packages/ironcode/src/tool/ffi"

console.log("🧪 Testing Integrated Native Edit Function")
console.log("=".repeat(60))

const tests = [
  {
    name: "Simple replace",
    content: "Hello world",
    old: "world",
    new: "Rust",
    expected: "Hello Rust",
  },
  {
    name: "Multiline with indentation",
    content: "  function test() {\n    return 42;\n  }",
    old: "function test() {\n    return 42;\n  }",
    new: "function newTest() {\n    return 100;\n  }",
    // LineTrimmedReplacer preserves the original indentation
    expected: "  function newTest() {\n    return 100;\n  }",
  },
  {
    name: "Replace all",
    content: "foo bar foo baz",
    old: "foo",
    new: "replaced",
    replaceAll: true,
    expected: "replaced bar replaced baz",
  },
]

let passed = 0
let failed = 0

for (const test of tests) {
  process.stdout.write(`\n${test.name}... `)
  try {
    const result = editReplaceFFI(test.content, test.old, test.new, test.replaceAll ?? false)
    if (result === test.expected) {
      console.log("✅ PASS")
      passed++
    } else {
      console.log("❌ FAIL")
      console.log(`  Expected: "${test.expected}"`)
      console.log(`  Got:      "${result}"`)
      failed++
    }
  } catch (e) {
    console.log(`❌ FAIL (error: ${(e as Error).message})`)
    failed++
  }
}

// Test error handling
process.stdout.write("\nError handling - not found... ")
try {
  editReplaceFFI("hello world", "xyz", "abc", false)
  console.log("❌ FAIL (should have thrown)")
  failed++
} catch (e) {
  const msg = (e as Error).message
  if (msg.includes("not found")) {
    console.log("✅ PASS")
    passed++
  } else {
    console.log(`❌ FAIL (wrong error: ${msg})`)
    failed++
  }
}

console.log("\n" + "=".repeat(60))
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

if (failed > 0) {
  console.log("\n❌ Integration test FAILED")
  process.exit(1)
} else {
  console.log("\n✅ Integration test PASSED - Native function working correctly!")
  process.exit(0)
}
