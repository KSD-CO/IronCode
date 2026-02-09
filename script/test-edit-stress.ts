#!/usr/bin/env bun

import { replace as tsReplace } from "../packages/ironcode/src/tool/edit"
import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import * as path from "path"

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

interface StressTest {
  name: string
  generateContent: () => string
  oldString: string
  newString: string
}

const stressTests: StressTest[] = [
  {
    name: "Large file - 1000 lines",
    generateContent: () => {
      let content = ""
      for (let i = 0; i < 1000; i++) {
        content += `function test${i}() {\n  return ${i};\n}\n`
      }
      return content
    },
    oldString: "function test500() {\n  return 500;\n}",
    newString: "function testReplaced() {\n  return 999;\n}",
  },
  {
    name: "Large file - 5000 lines",
    generateContent: () => {
      let content = ""
      for (let i = 0; i < 5000; i++) {
        content += `const value${i} = ${i};\n`
      }
      return content
    },
    oldString: "const value2500 = 2500;",
    newString: "const valueReplaced = 9999;",
  },
  {
    name: "Unicode characters",
    generateContent: () => "Hello 世界 🌍\nTest 测试 ✨\n日本語",
    oldString: "世界",
    newString: "Rust",
  },
  {
    name: "Special regex characters",
    generateContent: () => "test $var.prop[0] + (value * 2)",
    oldString: "$var.prop[0]",
    newString: "$newVar.field[1]",
  },
  {
    name: "Very long single line",
    generateContent: () => "x".repeat(10000) + "FINDME" + "y".repeat(10000),
    oldString: "FINDME",
    newString: "REPLACED",
  },
  {
    name: "Many similar blocks",
    generateContent: () => {
      let content = ""
      for (let i = 0; i < 100; i++) {
        content += `if (condition${i}) {\n  doSomething();\n}\n`
      }
      return content
    },
    oldString: "if (condition50) {\n  doSomething();\n}",
    newString: "if (newCondition) {\n  doNewThing();\n}",
  },
  {
    name: "Nested indentation",
    generateContent: () => `
      if (a) {
        if (b) {
          if (c) {
            console.log('deep');
          }
        }
      }
    `,
    oldString: `if (b) {
          if (c) {
            console.log('deep');
          }
        }`,
    newString: `if (b) {
          console.log('shallow');
        }`,
  },
  {
    name: "Mixed line endings (CRLF)",
    generateContent: () => "line1\r\nline2\r\nline3",
    oldString: "line2",
    newString: "replaced",
  },
  {
    name: "Empty lines in block",
    generateContent: () => `function test() {

  const x = 1;

  return x;
}`,
    oldString: `function test() {

  const x = 1;

  return x;
}`,
    newString: `function newTest() {
  const y = 2;
  return y;
}`,
  },
  {
    name: "Trailing whitespace variations",
    generateContent: () => "line1   \nline2\t\t\nline3  \t ",
    oldString: "line2",
    newString: "replaced",
  },
]

async function runStressTests() {
  console.log("🔥 Stress Testing TypeScript vs Rust")
  console.log("=".repeat(80))

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const test of stressTests) {
    process.stdout.write(`\n📝 ${test.name}... `)

    try {
      const content = test.generateContent()
      const contentSize = Buffer.byteLength(content)

      // Run TypeScript version
      const tsStart = performance.now()
      let tsResult: string | null = null
      let tsError: string | null = null
      try {
        tsResult = tsReplace(content, test.oldString, test.newString, false)
      } catch (e) {
        tsError = (e as Error).message
      }
      const tsTime = performance.now() - tsStart

      // Run Rust version
      const rustStart = performance.now()
      let rustResult: string | null = null
      let rustError: string | null = null
      try {
        rustResult = rustReplace(content, test.oldString, test.newString, false)
      } catch (e) {
        rustError = (e as Error).message
      }
      const rustTime = performance.now() - rustStart

      // Compare results
      if (tsError && rustError) {
        console.log("✅ PASS (both failed)")
        passed++
      } else if (tsError || rustError) {
        console.log("❌ FAIL (only one failed)")
        console.log(`  TS Error:   ${tsError}`)
        console.log(`  Rust Error: ${rustError}`)
        failed++
        failures.push(test.name)
      } else if (tsResult && rustResult) {
        if (tsResult === rustResult) {
          const speedup = (tsTime / rustTime).toFixed(2)
          console.log(`✅ PASS (${(contentSize / 1024).toFixed(1)}KB, Rust ${speedup}x faster)`)
          passed++
        } else {
          console.log("❌ FAIL (results differ)")
          console.log(`  Content size: ${contentSize} bytes`)
          console.log(`  TS result length:   ${tsResult.length}`)
          console.log(`  Rust result length: ${rustResult.length}`)
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
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${stressTests.length} tests`)

  if (failed > 0) {
    console.log("\n❌ Failed tests:")
    for (const name of failures) {
      console.log(`  - ${name}`)
    }
    process.exit(1)
  } else {
    console.log("\n✅ All stress tests passed! Implementation is rock solid! 🎉")
    process.exit(0)
  }
}

runStressTests()
