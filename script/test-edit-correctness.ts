#!/usr/bin/env bun

import { replace as tsReplace } from "../packages/ironcode/src/tool/edit"
import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import * as path from "path"

// Load Rust library
const libPath = path.join(
  import.meta.dir,
  "../packages/ironcode/native/tool/target/release",
  `libironcode_tool.${suffix}`,
)

const lib = dlopen(libPath, {
  edit_replace_ffi: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.bool],
    returns: FFIType.ptr,
  },
  free_string: {
    args: [FFIType.ptr],
    returns: FFIType.void,
  },
})

function rustReplace(content: string, oldString: string, newString: string, replaceAll: boolean): string {
  const contentBuf = Buffer.from(content + "\0")
  const oldBuf = Buffer.from(oldString + "\0")
  const newBuf = Buffer.from(newString + "\0")

  const ptr = lib.symbols.edit_replace_ffi(contentBuf, oldBuf, newBuf, replaceAll)
  if (!ptr) {
    throw new Error("FFI call returned null")
  }
  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  const response = JSON.parse(jsonStr)
  if (!response.success) {
    throw new Error(response.error)
  }
  return response.content
}

interface TestCase {
  name: string
  content: string
  oldString: string
  newString: string
  replaceAll?: boolean
  shouldFail?: boolean
  expectedError?: string
}

const testCases: TestCase[] = [
  // Simple replacements
  {
    name: "Simple exact match",
    content: "Hello world",
    oldString: "world",
    newString: "Rust",
  },
  {
    name: "Simple multiline",
    content: "Hello\nworld\ntest",
    oldString: "world",
    newString: "Rust",
  },
  {
    name: "Replace all occurrences",
    content: "foo bar foo baz foo",
    oldString: "foo",
    newString: "replaced",
    replaceAll: true,
  },

  // Line trimmed
  {
    name: "Line trimmed - indented lines",
    content: "  hello\n  world\n  test",
    oldString: "hello\nworld",
    newString: "goodbye\nworld",
  },
  {
    name: "Line trimmed - mixed indentation",
    content: "    function test() {\n        return 42;\n    }",
    oldString: "function test() {\n    return 42;\n}",
    newString: "function newTest() {\n    return 100;\n}",
  },

  // Block anchor
  {
    name: "Block anchor - exact match",
    content: "function foo() {\n  console.log('test');\n  return 1;\n}",
    oldString: "function foo() {\n  console.log('test');\n  return 1;\n}",
    newString: "function bar() {\n  console.log('new');\n  return 2;\n}",
  },
  {
    name: "Block anchor - with similarity",
    content: "function foo() {\n  console.log('hello');\n  return 42;\n}",
    oldString: "function foo() {\n  console.log('helo');\n  return 42;\n}",
    newString: "function bar() {\n  console.log('goodbye');\n  return 100;\n}",
  },

  // Whitespace normalized
  {
    name: "Whitespace normalized - extra spaces",
    content: "hello     world   test",
    oldString: "hello world test",
    newString: "goodbye world test",
  },
  {
    name: "Whitespace normalized - tabs and spaces",
    content: "hello\t\tworld\n  test",
    oldString: "hello world",
    newString: "goodbye world",
  },

  // Indentation flexible
  {
    name: "Indentation flexible - remove indent",
    content: "    if (true) {\n        console.log('test');\n    }",
    oldString: "if (true) {\n    console.log('test');\n}",
    newString: "if (false) {\n    console.log('new');\n}",
  },

  // Context aware
  {
    name: "Context aware - matching context",
    content: "start\nmiddle content\nend\nother\nstuff",
    oldString: "start\nmiddle\nend",
    newString: "begin\nnew\nfinish",
  },

  // Escape normalized
  {
    name: "Escape normalized - with newlines",
    content: "console.log('hello\\nworld');",
    oldString: "hello\\nworld",
    newString: "goodbye\\nworld",
  },

  // Trimmed boundary
  {
    name: "Trimmed boundary - with leading/trailing space",
    content: "  hello world  \ntest",
    oldString: "  hello world  ",
    newString: "goodbye",
  },

  // Multi occurrence
  {
    name: "Multi occurrence - should fail without replaceAll",
    content: "foo bar foo baz foo",
    oldString: "foo",
    newString: "replaced",
    shouldFail: true,
    expectedError: "multiple matches",
  },

  // Error cases
  {
    name: "Not found",
    content: "Hello world",
    oldString: "xyz",
    newString: "abc",
    shouldFail: true,
    expectedError: "not found",
  },
  {
    name: "Same strings",
    content: "Hello world",
    oldString: "world",
    newString: "world",
    shouldFail: true,
    expectedError: "must be different",
  },

  // Complex real-world examples
  {
    name: "Real code - function rename",
    content: `export function oldName(param: string) {
  const result = doSomething(param);
  return result;
}`,
    oldString: `export function oldName(param: string) {
  const result = doSomething(param);
  return result;
}`,
    newString: `export function newName(param: string) {
  const result = doSomething(param);
  return result;
}`,
  },
  {
    name: "Real code - JSX component",
    content: `<div className="container">
  <h1>Title</h1>
  <p>Content</p>
</div>`,
    oldString: `<div className="container">
  <h1>Title</h1>
  <p>Content</p>
</div>`,
    newString: `<section className="wrapper">
  <h2>New Title</h2>
  <span>New Content</span>
</section>`,
  },
]

async function runTests() {
  console.log("🧪 Testing TypeScript vs Rust Edit Implementation")
  console.log("=".repeat(80))

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const test of testCases) {
    process.stdout.write(`\n📝 ${test.name}... `)

    try {
      // Run TypeScript version
      let tsResult: string | null = null
      let tsError: string | null = null
      try {
        tsResult = tsReplace(test.content, test.oldString, test.newString, test.replaceAll || false)
      } catch (e) {
        tsError = (e as Error).message
      }

      // Run Rust version
      let rustResult: string | null = null
      let rustError: string | null = null
      try {
        rustResult = rustReplace(test.content, test.oldString, test.newString, test.replaceAll || false)
      } catch (e) {
        rustError = (e as Error).message
      }

      // Compare results
      if (test.shouldFail) {
        // Both should fail
        if (tsError && rustError) {
          // Check if error messages are similar
          const tsErrorLower = tsError.toLowerCase()
          const rustErrorLower = rustError.toLowerCase()
          const expectedLower = test.expectedError?.toLowerCase() || ""

          if (tsErrorLower.includes(expectedLower) && rustErrorLower.includes(expectedLower)) {
            console.log("✅ PASS (both failed as expected)")
            passed++
          } else {
            console.log("❌ FAIL (errors don't match)")
            console.log(`  TS Error:   ${tsError}`)
            console.log(`  Rust Error: ${rustError}`)
            console.log(`  Expected:   ${test.expectedError}`)
            failed++
            failures.push(test.name)
          }
        } else {
          console.log("❌ FAIL (should have failed but didn't)")
          console.log(`  TS Error:   ${tsError}`)
          console.log(`  Rust Error: ${rustError}`)
          failed++
          failures.push(test.name)
        }
      } else {
        // Both should succeed
        if (tsResult && rustResult) {
          if (tsResult === rustResult) {
            console.log("✅ PASS")
            passed++
          } else {
            console.log("❌ FAIL (results differ)")
            console.log(`  Content length: ${test.content.length} chars`)
            console.log(`  TS result:   "${tsResult.substring(0, 100)}${tsResult.length > 100 ? "..." : ""}"`)
            console.log(`  Rust result: "${rustResult.substring(0, 100)}${rustResult.length > 100 ? "..." : ""}"`)
            console.log(`  TS length:   ${tsResult.length}`)
            console.log(`  Rust length: ${rustResult.length}`)
            failed++
            failures.push(test.name)
          }
        } else {
          console.log("❌ FAIL (unexpected error)")
          console.log(`  TS Error:   ${tsError}`)
          console.log(`  Rust Error: ${rustError}`)
          failed++
          failures.push(test.name)
        }
      }
    } catch (e) {
      console.log(`❌ FAIL (exception: ${(e as Error).message})`)
      failed++
      failures.push(test.name)
    }
  }

  console.log("\n" + "=".repeat(80))
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`)

  if (failed > 0) {
    console.log("\n❌ Failed tests:")
    for (const name of failures) {
      console.log(`  - ${name}`)
    }
    process.exit(1)
  } else {
    console.log("\n✅ All tests passed! TypeScript and Rust implementations are identical.")
    process.exit(0)
  }
}

runTests()
