#!/usr/bin/env bun

import { replace as tsReplace } from "../packages/ironcode/src/tool/edit"
import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import * as path from "path"
import * as fs from "fs"

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

interface RealFileTest {
  name: string
  filePath: string
  oldString: string
  newString: string
}

const realFileTests: RealFileTest[] = [
  {
    name: "Edit tool itself - simple function name",
    filePath: "packages/ironcode/src/tool/edit.ts",
    oldString: "function normalizeLineEndings(text: string): string {",
    newString: "function normalizeLineEndingsNew(text: string): string {",
  },
  {
    name: "Edit tool - multiline function",
    filePath: "packages/ironcode/src/tool/edit.ts",
    oldString: `export const SimpleReplacer: Replacer = function* (_content, find) {
  yield find
}`,
    newString: `export const SimpleReplacer: Replacer = function* (_content, find) {
  // Updated implementation
  yield find
}`,
  },
  {
    name: "Lib.rs - FFI function signature",
    filePath: "packages/ironcode/native/tool/src/lib.rs",
    oldString: 'pub extern "C" fn glob_ffi(pattern: *const c_char, search: *const c_char) -> *mut c_char {',
    newString: 'pub extern "C" fn glob_ffi_new(pattern: *const c_char, search: *const c_char) -> *mut c_char {',
  },
  {
    name: "Package.json - version bump",
    filePath: "package.json",
    oldString: '"name": "ironcode",',
    newString: '"name": "ironcode-updated",',
  },
]

async function runRealFileTests() {
  console.log("🧪 Testing with Real Files from Codebase")
  console.log("=".repeat(80))

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const test of realFileTests) {
    process.stdout.write(`\n📝 ${test.name}... `)

    try {
      // Read file content
      const fullPath = path.join(import.meta.dir, "..", test.filePath)
      if (!fs.existsSync(fullPath)) {
        console.log(`⏭️  SKIP (file not found: ${test.filePath})`)
        continue
      }

      const content = await Bun.file(fullPath).text()

      // Run TypeScript version
      let tsResult: string | null = null
      let tsError: string | null = null
      try {
        tsResult = tsReplace(content, test.oldString, test.newString, false)
      } catch (e) {
        tsError = (e as Error).message
      }

      // Run Rust version
      let rustResult: string | null = null
      let rustError: string | null = null
      try {
        rustResult = rustReplace(content, test.oldString, test.newString, false)
      } catch (e) {
        rustError = (e as Error).message
      }

      // Compare results
      if (tsError && rustError) {
        // Both failed - check if errors are similar
        if (tsError.toLowerCase().includes("not found") && rustError.toLowerCase().includes("not found")) {
          console.log("✅ PASS (both failed with 'not found')")
          passed++
        } else {
          console.log("❌ FAIL (different errors)")
          console.log(`  TS Error:   ${tsError}`)
          console.log(`  Rust Error: ${rustError}`)
          failed++
          failures.push(test.name)
        }
      } else if (tsError || rustError) {
        console.log("❌ FAIL (only one failed)")
        console.log(`  TS Error:   ${tsError}`)
        console.log(`  Rust Error: ${rustError}`)
        failed++
        failures.push(test.name)
      } else if (tsResult && rustResult) {
        if (tsResult === rustResult) {
          console.log(`✅ PASS (file size: ${content.length} chars)`)
          passed++
        } else {
          console.log("❌ FAIL (results differ)")
          console.log(`  File size: ${content.length} chars`)
          console.log(`  TS result length:   ${tsResult.length}`)
          console.log(`  Rust result length: ${rustResult.length}`)

          // Find first difference
          for (let i = 0; i < Math.min(tsResult.length, rustResult.length); i++) {
            if (tsResult[i] !== rustResult[i]) {
              const start = Math.max(0, i - 50)
              const end = Math.min(tsResult.length, i + 50)
              console.log(`  First diff at position ${i}:`)
              console.log(`    TS:   "${tsResult.substring(start, end)}"`)
              console.log(`    Rust: "${rustResult.substring(start, end)}"`)
              break
            }
          }
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
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${realFileTests.length} tests`)

  if (failed > 0) {
    console.log("\n❌ Failed tests:")
    for (const name of failures) {
      console.log(`  - ${name}`)
    }
    process.exit(1)
  } else {
    console.log("\n✅ All real file tests passed!")
    process.exit(0)
  }
}

runRealFileTests()
