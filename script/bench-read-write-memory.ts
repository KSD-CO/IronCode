#!/usr/bin/env bun
/**
 * Memory benchmark for read/write operations
 * Compares TypeScript vs Rust FFI with detailed memory tracking
 */

import { readFFI, writeFFI } from "../packages/ironcode/src/tool/ffi"
import path from "path"
import * as fs from "fs"
import { performance } from "perf_hooks"

// Memory measurement helper
function measureMemory<T>(
  name: string,
  fn: () => T,
  iterations: number,
): {
  avgTime: number
  result: T
  peakHeap: number
  heapDelta: number
} {
  // Warmup
  for (let i = 0; i < 5; i++) fn()

  if (global.gc) global.gc()
  const startHeap = process.memoryUsage().heapUsed

  let peakHeap = startHeap
  let result: T

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    result = fn()
    const currentHeap = process.memoryUsage().heapUsed
    if (currentHeap > peakHeap) peakHeap = currentHeap
  }
  const end = performance.now()

  if (global.gc) global.gc()
  const endHeap = process.memoryUsage().heapUsed

  return {
    avgTime: (end - start) / iterations,
    result: result!,
    peakHeap,
    heapDelta: endHeap - startHeap,
  }
}

console.log("📊 Read/Write Memory Benchmark (TypeScript vs Rust)")
console.log("Run with: bun --expose-gc script/bench-read-write-memory.ts\n")

if (!global.gc) {
  console.warn("⚠️  Warning: Run with --expose-gc flag for accurate memory measurements\n")
}

// ============================================================================
// READ Benchmarks - Generate test files with various line counts
// ============================================================================
console.log("=".repeat(80))
console.log("📖 READ Operations\n")

// Generate test files
function generateTestFile(lines: number): string {
  const tempFile = path.join("/tmp", `bench-read-${lines}lines.txt`)
  let content = ""
  for (let i = 0; i < lines; i++) {
    content += `function test${i}() { console.log("line ${i}"); return ${i}; }\n`
  }
  fs.writeFileSync(tempFile, content)
  return tempFile
}

const readTests = [
  { name: "Small (100 lines)", lines: 100 },
  { name: "Medium (500 lines)", lines: 500 },
  { name: "Large (1K lines)", lines: 1000 },
  { name: "X-Large (2K lines)", lines: 2000 },
  { name: "XX-Large (3K lines)", lines: 3000 },
  { name: "Huge (5K lines)", lines: 5000 },
]

for (const { name, lines } of readTests) {
  const fullPath = generateTestFile(lines)
  const fileSize = fs.statSync(fullPath).size
  const iterations = 50

  console.log(`\n${name} (${(fileSize / 1024).toFixed(1)}KB, ${iterations} iterations)`)

  // Rust FFI
  const rustResult = measureMemory("Rust FFI", () => readFFI(fullPath), iterations)

  // TypeScript
  const tsResult = measureMemory("TypeScript", () => fs.readFileSync(fullPath, "utf-8"), iterations)

  console.log(`Rust FFI:`)
  console.log(`  Time:        ${(rustResult.avgTime * 1000).toFixed(2)} µs`)
  console.log(`  Peak heap:   ${(rustResult.peakHeap / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Heap delta:  ${(rustResult.heapDelta / 1024).toFixed(2)} KB`)

  console.log(`\nTypeScript (fs.readFileSync):`)
  console.log(`  Time:        ${(tsResult.avgTime * 1000).toFixed(2)} µs`)
  console.log(`  Peak heap:   ${(tsResult.peakHeap / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Heap delta:  ${(tsResult.heapDelta / 1024).toFixed(2)} KB`)

  const speedup = tsResult.avgTime / rustResult.avgTime
  const memoryRatio = rustResult.peakHeap / tsResult.peakHeap

  console.log(`\nComparison:`)
  console.log(`  Speed:       ${speedup.toFixed(2)}x ${speedup > 1 ? "(Rust faster)" : "(TS faster)"}`)
  console.log(`  Memory:      ${memoryRatio.toFixed(2)}x peak heap (Rust vs TS)`)

  // Cleanup
  try {
    fs.unlinkSync(fullPath)
  } catch {}
}

// ============================================================================
// WRITE Benchmarks - Test with various sizes
// ============================================================================
console.log("\n" + "=".repeat(80))
console.log("✍️  WRITE Operations\n")

function generateWriteContent(lines: number): string {
  let content = ""
  for (let i = 0; i < lines; i++) {
    content += `function test${i}() { console.log("line ${i}"); return ${i}; }\n`
  }
  return content
}

const writeTests = [
  { name: "Small (100 lines)", lines: 100 },
  { name: "Medium (500 lines)", lines: 500 },
  { name: "Large (1K lines)", lines: 1000 },
  { name: "X-Large (2K lines)", lines: 2000 },
  { name: "XX-Large (3K lines)", lines: 3000 },
  { name: "Huge (5K lines)", lines: 5000 },
]

for (const { name, lines } of writeTests) {
  const content = generateWriteContent(lines)
  const size = Buffer.byteLength(content)
  const tempFile = path.join("/tmp", `bench-write-${lines}lines.txt`)
  const iterations = 50

  console.log(`\n${name} (${(size / 1024).toFixed(1)}KB, ${iterations} iterations)`)

  // Rust FFI
  const rustResult = measureMemory("Rust FFI", () => writeFFI(tempFile, content), iterations)

  // TypeScript
  const tsResult = measureMemory("TypeScript", () => fs.writeFileSync(tempFile, content), iterations)

  console.log(`Rust FFI:`)
  console.log(`  Time:        ${(rustResult.avgTime * 1000).toFixed(2)} µs`)
  console.log(`  Peak heap:   ${(rustResult.peakHeap / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Heap delta:  ${(rustResult.heapDelta / 1024).toFixed(2)} KB`)

  console.log(`\nTypeScript (fs.writeFileSync):`)
  console.log(`  Time:        ${(tsResult.avgTime * 1000).toFixed(2)} µs`)
  console.log(`  Peak heap:   ${(tsResult.peakHeap / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  Heap delta:  ${(tsResult.heapDelta / 1024).toFixed(2)} KB`)

  const speedup = tsResult.avgTime / rustResult.avgTime
  const memoryRatio = rustResult.peakHeap / tsResult.peakHeap

  console.log(`\nComparison:`)
  console.log(`  Speed:       ${speedup.toFixed(2)}x ${speedup > 1 ? "(Rust faster)" : "(TS faster)"}`)
  console.log(`  Memory:      ${memoryRatio.toFixed(2)}x peak heap (Rust vs TS)`)

  // Cleanup
  try {
    fs.unlinkSync(tempFile)
  } catch {}
}

console.log("\n" + "=".repeat(80))
console.log("\n✅ Benchmark complete!")
console.log("\nKey Takeaways:")
console.log("- TypeScript/Bun has highly optimized file I/O (faster for small files)")
console.log("- Rust FFI has overhead cost but check memory usage comparison")
console.log("- Trade-off: Speed vs Memory depends on file size and operation frequency")
