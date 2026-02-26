#!/usr/bin/env bun

/**
 * Benchmark comparing bash command parsing implementations:
 * - web-tree-sitter (WASM - original implementation)
 * - Native Rust tree-sitter (new implementation)
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

  // Import from workspace root node_modules
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

  // Simplified parsing logic - just walk the tree
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

    if (command.length) {
      patterns.add(commandText)
      // Simplified "always" logic
      always.add(command[0] + " *")
    }
  }

  return {
    directories: Array.from(directories),
    patterns: Array.from(patterns),
    always: Array.from(always),
  }
}

// Test commands of varying complexity
const testCommands = [
  // Simple commands
  "ls -la",
  "echo hello world",
  "git status",

  // File operations
  "cp /tmp/file.txt /home/user/dest.txt",
  "rm -rf /tmp/old_directory",
  "mkdir -p /home/user/projects/new-project",

  // Complex pipelines
  "cat file.txt | grep 'pattern' | sort | uniq",
  "find . -name '*.ts' | xargs wc -l",

  // Multiple commands
  "cd /tmp && npm install && npm test",
  "git add . && git commit -m 'message' && git push",

  // Redirects and compound
  "echo 'data' > output.txt && cat output.txt | sed 's/foo/bar/g' > result.txt",
  "npm run build 2>&1 | tee build.log",

  // Very complex
  "for file in *.ts; do echo \"Processing $file\"; cat $file | grep 'export' >> exports.txt; done",
  "(cd packages/ironcode && bun test) && (cd packages/app && bun test)",
]

// Benchmark function with memory tracking
async function benchmark(
  name: string,
  fn: (command: string, cwd: string) => Promise<BashParseResult> | BashParseResult,
  commands: string[],
  iterations: number = 100,
): Promise<{ avgTimeMs: number; totalTimeMs: number; peakMemoryMB: number }> {
  const cwd = "/tmp"

  // Force GC before warmup if available
  if (global.gc) global.gc()

  // Warmup
  for (let i = 0; i < 5; i++) {
    for (const cmd of commands) {
      await fn(cmd, cwd)
    }
  }

  // Force GC before measurement
  if (global.gc) global.gc()

  const memBefore = process.memoryUsage().heapUsed
  let peakMemory = memBefore

  // Actual benchmark
  const start = Bun.nanoseconds()
  for (let i = 0; i < iterations; i++) {
    for (const cmd of commands) {
      await fn(cmd, cwd)
      const currentMem = process.memoryUsage().heapUsed
      if (currentMem > peakMemory) peakMemory = currentMem
    }
  }
  const end = Bun.nanoseconds()

  const totalTimeMs = (end - start) / 1_000_000
  const avgTimeMs = totalTimeMs / iterations / commands.length
  const peakMemoryMB = (peakMemory - memBefore) / 1024 / 1024

  return { avgTimeMs, totalTimeMs, peakMemoryMB }
}

// Run benchmarks
console.log("🔬 Bash Parser Benchmark: WASM vs Native Rust")
console.log("=".repeat(80))
console.log()

// Initialize WASM parser first (so initialization time is not counted)
console.log("⏳ Initializing WASM parser...")
await initWasmParser()
console.log("✅ WASM parser initialized")
console.log()

console.log(`📊 Testing with ${testCommands.length} commands of varying complexity`)
console.log("-".repeat(80))
console.log()

const iterations = 100

console.log(`Running ${iterations} iterations for each parser...`)
console.log()

const wasm = await benchmark("WASM tree-sitter", parseWithWasm, testCommands, iterations)
const rust = await benchmark("Rust tree-sitter", parseWithRust, testCommands, iterations)

// Calculate speedup
const speedup = (wasm.avgTimeMs / rust.avgTimeMs).toFixed(2)
const totalSpeedup = (wasm.totalTimeMs / rust.totalTimeMs).toFixed(2)

console.log("Results:")
console.log()
console.log(`  WASM tree-sitter:`)
console.log(`    Average per command: ${wasm.avgTimeMs.toFixed(3)}ms`)
console.log(`    Total time:          ${wasm.totalTimeMs.toFixed(2)}ms`)
console.log(`    Peak memory:         ${wasm.peakMemoryMB.toFixed(2)}MB`)
console.log()
console.log(`  Rust tree-sitter:`)
console.log(`    Average per command: ${rust.avgTimeMs.toFixed(3)}ms`)
console.log(`    Total time:          ${rust.totalTimeMs.toFixed(2)}ms`)
console.log(`    Peak memory:         ${rust.peakMemoryMB.toFixed(2)}MB`)
console.log()

if (parseFloat(speedup) > 1.0) {
  console.log(`⚡ Rust is ${speedup}x FASTER than WASM (per command)`)
  console.log(`⚡ Rust is ${totalSpeedup}x FASTER than WASM (total time)`)
} else {
  const slowdown = (rust.avgTimeMs / wasm.avgTimeMs).toFixed(2)
  console.log(`⚠️  Rust is ${slowdown}x SLOWER than WASM`)
}

const memoryDiff = rust.peakMemoryMB - wasm.peakMemoryMB
if (memoryDiff > 0) {
  console.log(`💾 Rust uses ${Math.abs(memoryDiff).toFixed(2)}MB MORE memory`)
} else {
  console.log(`💾 Rust uses ${Math.abs(memoryDiff).toFixed(2)}MB LESS memory`)
}

console.log()
console.log("=".repeat(80))
console.log("✅ Benchmark complete!")
console.log()
console.log("📝 Notes:")
console.log("  - Average time: Time per command parse (lower is better)")
console.log("  - Total time: Time for all commands across all iterations")
console.log("  - Memory: Peak heap allocation during benchmark (lower is better)")
console.log("  - WASM initialization time is NOT included (both parsers are pre-initialized)")
console.log("  - In production, WASM has significant initialization overhead (~100-200ms)")
console.log(`  - All results are averaged over ${iterations} iterations`)
console.log()
console.log("💡 To enable GC during benchmark, run: bun --expose-gc script/bench-bash-parse.ts")
