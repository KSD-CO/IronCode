#!/usr/bin/env bun

import { replace } from "../packages/ironcode/src/tool/edit"

function generateTestContent(lines: number): string {
  let content = ""
  for (let i = 0; i < lines; i++) {
    content += `    function test${i}() {\n`
    content += `        console.log('hello');\n`
    content += `        return 42;\n`
    content += `    }\n`
  }
  return content
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

async function benchmarkSize(lines: number) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`Benchmarking ${lines} lines`)
  console.log("=".repeat(60))

  const content = generateTestContent(lines)
  const contentSize = Buffer.byteLength(content)
  console.log(`Content size: ${formatBytes(contentSize)}`)

  // Force GC before test
  if (global.gc) global.gc()

  const startMem = process.memoryUsage()
  const startTime = performance.now()

  // Run replace operation
  const iterations = lines <= 100 ? 1000 : lines <= 1000 ? 100 : 10
  for (let i = 0; i < iterations; i++) {
    try {
      replace(content, "console.log('hello');", "console.log('goodbye');", false)
    } catch (e) {
      // Expected for some cases
    }
  }

  const endTime = performance.now()
  const endMem = process.memoryUsage()

  // Force GC after test
  if (global.gc) global.gc()
  await new Promise((resolve) => setTimeout(resolve, 100))
  const afterGCMem = process.memoryUsage()

  const duration = (endTime - startTime) / iterations
  const heapUsed = endMem.heapUsed - startMem.heapUsed
  const heapTotal = endMem.heapTotal - startMem.heapTotal
  const peakHeap = afterGCMem.heapUsed

  console.log(`\nTypeScript Performance:`)
  console.log(`  Time per operation: ${formatTime(duration)}`)
  console.log(`  Heap used delta: ${formatBytes(heapUsed)}`)
  console.log(`  Heap total delta: ${formatBytes(heapTotal)}`)
  console.log(`  Peak heap (after GC): ${formatBytes(peakHeap)}`)
  console.log(`  Iterations: ${iterations}`)
}

async function main() {
  console.log("Edit Tool Memory & Performance Benchmark (TypeScript)")
  console.log("Run with: bun --expose-gc script/bench-edit-memory.ts")

  if (!global.gc) {
    console.warn("\n⚠️  WARNING: GC not exposed. Run with --expose-gc flag for accurate memory measurements")
  }

  // Warm up
  console.log("\nWarming up...")
  const warmup = generateTestContent(10)
  for (let i = 0; i < 100; i++) {
    try {
      replace(warmup, "hello", "goodbye", false)
    } catch (e) {}
  }

  // Run benchmarks
  await benchmarkSize(10)
  await benchmarkSize(100)
  await benchmarkSize(1000)
  await benchmarkSize(5000)
  await benchmarkSize(10000)

  console.log("\n" + "=".repeat(60))
  console.log("Benchmark complete!")
  console.log("=".repeat(60))
}

main()
