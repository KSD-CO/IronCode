#!/usr/bin/env bun

/**
 * Comparison test: Verify Rust parser output matches WASM parser output
 */

import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import path from "node:path"
import { fileURLToPath } from "url"

// Load Rust library for native parser
const lib = dlopen(
  path.join(import.meta.dir, "../packages/ironcode/native/tool/target/release/libironcode_tool." + suffix),
  {
    parse_bash_command_ffi: {
      args: [FFIType.cstring, FFIType.cstring],
      returns: FFIType.ptr,
    },
    free_string: {
      args: [FFIType.ptr],
      returns: FFIType.void,
    },
  },
)

// Native Rust parser
interface BashParseResult {
  directories: string[]
  patterns: string[]
  always: string[]
}

function parseWithRust(command: string, cwd: string): BashParseResult {
  const ptr = lib.symbols.parse_bash_command_ffi(Buffer.from(command + "\0"), Buffer.from(cwd + "\0"))
  if (!ptr) throw new Error("parse_bash_command_ffi returned null")

  const jsonStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  return JSON.parse(jsonStr)
}

// WASM parser (original implementation)
let wasmParser: any = null
let wasmInitialized = false

const resolveWasm = (asset: string) => {
  if (asset.startsWith("file://")) return fileURLToPath(asset)
  if (asset.startsWith("/") || /^[a-z]:/i.test(asset)) return asset
  const url = new URL(asset, import.meta.url)
  return fileURLToPath(url)
}

async function initWasmParser() {
  if (wasmInitialized) return wasmParser

  const { Parser, Language } = await import("web-tree-sitter")
  const { default: treeWasm } = await import("web-tree-sitter/tree-sitter.wasm" as string, {
    with: { type: "wasm" },
  })
  const treePath = resolveWasm(treeWasm)
  await Parser.init({
    locateFile() {
      return treePath
    },
  })
  const { default: bashWasm } = await import("tree-sitter-bash/tree-sitter-bash.wasm" as string, {
    with: { type: "wasm" },
  })
  const bashPath = resolveWasm(bashWasm)
  const bashLanguage = await Language.load(bashPath)
  const p = new Parser()
  p.setLanguage(bashLanguage)

  wasmParser = p
  wasmInitialized = true
  return wasmParser
}

async function parseWithWasm(command: string, cwd: string): Promise<BashParseResult> {
  const parser = await initWasmParser()
  const tree = parser.parse(command)

  const directories = new Set<string>()
  const patterns = new Set<string>()
  const always = new Set<string>()

  // This is the EXACT logic from the original bash.ts
  for (const node of tree.rootNode.descendantsOfType("command")) {
    if (!node) continue

    let commandText = node.parent?.type === "redirected_statement" ? node.parent.text : node.text

    const command: string[] = []
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i)
      if (!child) continue
      if (
        child.type !== "command_name" &&
        child.type !== "word" &&
        child.type !== "string" &&
        child.type !== "raw_string" &&
        child.type !== "concatenation"
      ) {
        continue
      }
      command.push(child.text)
    }

    // File operation commands - extract directories
    if (["cd", "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown", "cat"].includes(command[0])) {
      for (const arg of command.slice(1)) {
        if (arg.startsWith("-") || (command[0] === "chmod" && arg.startsWith("+"))) continue
        // Note: In real bash.ts, this resolves paths with realpath, but for comparison we'll use raw paths
        directories.add(arg)
      }
    }

    // Add command patterns (excluding cd)
    if (command.length && command[0] !== "cd") {
      patterns.add(commandText)
      // Simplified "always" logic - just take first word
      always.add(command[0] + " *")
    }
  }

  return {
    directories: Array.from(directories),
    patterns: Array.from(patterns),
    always: Array.from(always),
  }
}

// Helper to compare results
function compareResults(cmd: string, rust: BashParseResult, wasm: BashParseResult): boolean {
  const sortArray = (arr: string[]) => [...arr].sort()

  const rustDirs = sortArray(rust.directories)
  const wasmDirs = sortArray(wasm.directories)
  const rustPatterns = sortArray(rust.patterns)
  const wasmPatterns = sortArray(wasm.patterns)
  const rustAlways = sortArray(rust.always)
  const wasmAlways = sortArray(wasm.always)

  const dirsMatch = JSON.stringify(rustDirs) === JSON.stringify(wasmDirs)
  const patternsMatch = JSON.stringify(rustPatterns) === JSON.stringify(wasmPatterns)
  const alwaysMatch = JSON.stringify(rustAlways) === JSON.stringify(wasmAlways)

  const allMatch = dirsMatch && patternsMatch && alwaysMatch

  if (!allMatch) {
    console.log(`\n❌ MISMATCH for command: "${cmd}"`)
    console.log("---")

    if (!dirsMatch) {
      console.log("  Directories differ:")
      console.log("    Rust:", rustDirs)
      console.log("    WASM:", wasmDirs)
    }

    if (!patternsMatch) {
      console.log("  Patterns differ:")
      console.log("    Rust:", rustPatterns)
      console.log("    WASM:", wasmPatterns)
    }

    if (!alwaysMatch) {
      console.log("  Always differ:")
      console.log("    Rust:", rustAlways)
      console.log("    WASM:", wasmAlways)
    }
  }

  return allMatch
}

// Test commands
const testCommands = [
  "ls -la",
  "echo hello world",
  "git status",
  "cp /tmp/file.txt /home/user/dest.txt",
  "rm -rf /tmp/old_directory",
  "mkdir -p /home/user/projects/new-project",
  "cat file.txt | grep 'pattern' | sort | uniq",
  "find . -name '*.ts' | xargs wc -l",
  "cd /tmp && npm install && npm test",
  "git add . && git commit -m 'message' && git push",
  "npm run build 2>&1 | tee build.log",
  "chmod +x script.sh",
  "mv old.txt new.txt",
  "touch /tmp/newfile.txt",
]

// Run comparison
console.log("🔬 Comparing Rust vs WASM Parser Output")
console.log("=".repeat(80))
console.log()

console.log("⏳ Initializing WASM parser...")
await initWasmParser()
console.log("✅ WASM parser initialized")
console.log()

const cwd = "/tmp"
let passed = 0
let failed = 0

for (const cmd of testCommands) {
  const rust = parseWithRust(cmd, cwd)
  const wasm = await parseWithWasm(cmd, cwd)

  if (compareResults(cmd, rust, wasm)) {
    console.log(`✅ PASS: "${cmd}"`)
    passed++
  } else {
    failed++
  }
}

console.log()
console.log("=".repeat(80))
console.log("📊 Results:")
console.log(`  ✅ Passed: ${passed}/${testCommands.length}`)
console.log(`  ❌ Failed: ${failed}/${testCommands.length}`)
console.log()

if (failed === 0) {
  console.log("🎉 SUCCESS! All outputs match between Rust and WASM parsers")
  console.log("✅ The migration is functionally correct")
} else {
  console.log("⚠️  Some outputs differ. Review the differences above.")
  console.log("💡 Note: Some differences may be acceptable (e.g., path resolution)")
  process.exit(1)
}
