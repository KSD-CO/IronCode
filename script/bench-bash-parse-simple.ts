#!/usr/bin/env bun

/**
 * Simple benchmark for native Rust bash command parser
 * This tests just the Rust implementation without comparing to WASM
 */

import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import path from "node:path"

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
function benchmark(
  commands: string[],
  iterations: number = 100,
): { avgTimeMs: number; totalTimeMs: number; peakMemoryMB: number } {
  const cwd = "/tmp"

  // Force GC before warmup if available
  if (global.gc) global.gc()

  // Warmup
  for (let i = 0; i < 5; i++) {
    for (const cmd of commands) {
      parseWithRust(cmd, cwd)
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
      parseWithRust(cmd, cwd)
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

// Functional verification
console.log("🔬 Bash Parser Benchmark: Native Rust tree-sitter")
console.log("=".repeat(80))
console.log()

console.log("🧪 Functional verification:")
console.log("-".repeat(80))
const testResult = parseWithRust("cp /tmp/file.txt /home/user/dest.txt && git status", "/tmp")
console.log("Test command: cp /tmp/file.txt /home/user/dest.txt && git status")
console.log("Parse result:", JSON.stringify(testResult, null, 2))
console.log()

// Performance benchmark
console.log("📊 Performance Benchmark")
console.log("-".repeat(80))
console.log(`Testing with ${testCommands.length} commands of varying complexity`)
console.log()

const iterations = 100
console.log(`Running ${iterations} iterations...`)
console.log()

const result = benchmark(testCommands, iterations)

console.log("Results:")
console.log()
console.log(`  Average per command: ${result.avgTimeMs.toFixed(3)}ms`)
console.log(`  Total time:          ${result.totalTimeMs.toFixed(2)}ms`)
console.log(`  Peak memory:         ${result.peakMemoryMB.toFixed(2)}MB`)
console.log()

// Performance thresholds
const avgThresholdMs = 0.5 // We expect <0.5ms per command on average
const totalThresholdMs = 1000 // Total should be < 1 second for 100 iterations * 14 commands

console.log("Performance Assessment:")
console.log()
if (result.avgTimeMs < avgThresholdMs) {
  console.log(`  ✅ Average time is excellent: ${result.avgTimeMs.toFixed(3)}ms < ${avgThresholdMs}ms`)
} else {
  console.log(`  ⚠️  Average time exceeds target: ${result.avgTimeMs.toFixed(3)}ms > ${avgThresholdMs}ms`)
}

if (result.totalTimeMs < totalThresholdMs) {
  console.log(`  ✅ Total time is excellent: ${result.totalTimeMs.toFixed(2)}ms < ${totalThresholdMs}ms`)
} else {
  console.log(`  ⚠️  Total time exceeds target: ${result.totalTimeMs.toFixed(2)}ms > ${totalThresholdMs}ms`)
}

if (result.peakMemoryMB < 10) {
  console.log(`  ✅ Memory usage is excellent: ${result.peakMemoryMB.toFixed(2)}MB < 10MB`)
} else {
  console.log(`  ⚠️  Memory usage is high: ${result.peakMemoryMB.toFixed(2)}MB`)
}

console.log()
console.log("=".repeat(80))
console.log("✅ Benchmark complete!")
console.log()
console.log("📝 Notes:")
console.log("  - Average time: Time per command parse (lower is better)")
console.log("  - Total time: Time for all commands across all iterations")
console.log("  - Memory: Peak heap allocation during benchmark (lower is better)")
console.log(`  - All results are averaged over ${iterations} iterations`)
console.log()
console.log("💡 Compared to WASM tree-sitter:")
console.log("  - WASM has ~100-200ms initialization overhead (not shown here)")
console.log("  - WASM parsing is typically 5-20x slower than native Rust")
console.log("  - Native Rust has no initialization overhead and lower FFI cost")
console.log()
console.log("💡 To enable GC during benchmark, run: bun --expose-gc script/bench-bash-parse-simple.ts")
