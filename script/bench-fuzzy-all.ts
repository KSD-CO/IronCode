#!/usr/bin/env bun

/**
 * Comprehensive benchmark comparing fuzzy search implementations:
 * - fuzzysort (JavaScript - current baseline)
 * - Rust FFI + fuzzy-matcher (skim algorithm)
 * - Rust FFI + nucleo-matcher (Helix editor)
 * - Rust FFI + sublime_fuzzy (Sublime Text)
 */

import fuzzysort from "fuzzysort"
import { dlopen, FFIType, suffix, CString } from "bun:ffi"
import path from "node:path"

// Load Rust library
const lib = dlopen(
  path.join(import.meta.dir, "../packages/ironcode/native/tool/target/release/libironcode_tool." + suffix),
  {
    fuzzy_search_skim_ffi: {
      args: [FFIType.cstring, FFIType.cstring, FFIType.i32],
      returns: FFIType.ptr,
    },
    fuzzy_search_nucleo_ffi: {
      args: [FFIType.cstring, FFIType.cstring, FFIType.i32],
      returns: FFIType.ptr,
    },
    fuzzy_search_sublime_ffi: {
      args: [FFIType.cstring, FFIType.cstring, FFIType.i32],
      returns: FFIType.ptr,
    },
    free_string: {
      args: [FFIType.ptr],
      returns: FFIType.void,
    },
  },
)

// Helper to call Rust FFI and parse results
function fuzzySearchRustFFI(ffiFunction: any, query: string, items: string[], limit?: number): string[] {
  const itemsNewlineSeparated = items.join("\n")
  const limitValue = limit === undefined ? -1 : limit

  const ptr = ffiFunction(
    Buffer.from(query + "\0", "utf-8"),
    Buffer.from(itemsNewlineSeparated + "\0", "utf-8"),
    limitValue,
  )

  if (!ptr) return []

  const resultStr = new CString(ptr).toString()
  lib.symbols.free_string(ptr)

  if (!resultStr) return []
  return resultStr.split("\n").filter((s) => s.length > 0)
}

// Wrapper functions for each strategy
function fuzzySearchSkim(query: string, items: string[], limit?: number): string[] {
  return fuzzySearchRustFFI(lib.symbols.fuzzy_search_skim_ffi, query, items, limit)
}

function fuzzySearchNucleo(query: string, items: string[], limit?: number): string[] {
  return fuzzySearchRustFFI(lib.symbols.fuzzy_search_nucleo_ffi, query, items, limit)
}

function fuzzySearchSublime(query: string, items: string[], limit?: number): string[] {
  return fuzzySearchRustFFI(lib.symbols.fuzzy_search_sublime_ffi, query, items, limit)
}

function fuzzySearchFuzzysort(query: string, items: string[], limit?: number): string[] {
  const results = fuzzysort.go(query, items, { limit: limit || items.length })
  return results.map((r) => r.target)
}

// Generate test data
function generateFilePaths(count: number): string[] {
  const paths: string[] = []
  const dirs = ["src", "lib", "packages", "components", "utils", "services", "test"]
  const files = ["index", "main", "app", "config", "helper", "util", "service", "component"]
  const exts = [".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".py"]

  for (let i = 0; i < count; i++) {
    const depth = Math.floor(Math.random() * 3) + 1
    let pathParts: string[] = []

    for (let d = 0; d < depth; d++) {
      pathParts.push(dirs[Math.floor(Math.random() * dirs.length)])
    }

    const fileName = files[Math.floor(Math.random() * files.length)] + (i % 100)
    const ext = exts[Math.floor(Math.random() * exts.length)]
    pathParts.push(fileName + ext)

    paths.push(pathParts.join("/"))
  }

  return paths
}

// Benchmark function with memory tracking
function benchmark(
  name: string,
  fn: (query: string, items: string[], limit?: number) => string[],
  query: string,
  items: string[],
  iterations: number = 100,
): { avgTimeMs: number; peakMemoryMB: number } {
  // Force GC before warmup if available
  if (global.gc) global.gc()

  // Warmup
  for (let i = 0; i < 10; i++) {
    fn(query, items, 10)
  }

  // Force GC before measurement
  if (global.gc) global.gc()

  const memBefore = process.memoryUsage().heapUsed
  let peakMemory = memBefore

  // Actual benchmark
  const start = Bun.nanoseconds()
  for (let i = 0; i < iterations; i++) {
    fn(query, items, 10)
    const currentMem = process.memoryUsage().heapUsed
    if (currentMem > peakMemory) peakMemory = currentMem
  }
  const end = Bun.nanoseconds()

  const avgTimeMs = (end - start) / iterations / 1_000_000
  const peakMemoryMB = (peakMemory - memBefore) / 1024 / 1024

  return { avgTimeMs, peakMemoryMB }
}

// Run benchmarks
const testSizes = [100, 1000, 5000, 10000]
const queries = ["src", "comp", "index", "util"]

console.log("🔬 Fuzzy Search Benchmark: Comprehensive Comparison")
console.log("=".repeat(80))
console.log()

for (const size of testSizes) {
  console.log(`📊 Dataset size: ${size} files`)
  console.log("-".repeat(80))

  const items = generateFilePaths(size)

  for (const query of queries) {
    console.log(`\n  Query: "${query}"`)

    const fuzzysort = benchmark("fuzzysort (JS)", fuzzySearchFuzzysort, query, items, 100)
    const skim = benchmark("Rust (skim)", fuzzySearchSkim, query, items, 100)
    const nucleo = benchmark("Rust (nucleo)", fuzzySearchNucleo, query, items, 100)
    const sublime = benchmark("Rust (sublime)", fuzzySearchSublime, query, items, 100)

    // Calculate speedup/slowdown
    const skimSpeedup = (fuzzysort.avgTimeMs / skim.avgTimeMs).toFixed(2)
    const nucleoSpeedup = (fuzzysort.avgTimeMs / nucleo.avgTimeMs).toFixed(2)
    const sublimeSpeedup = (fuzzysort.avgTimeMs / sublime.avgTimeMs).toFixed(2)

    console.log(
      `    fuzzysort (JS):      ${fuzzysort.avgTimeMs.toFixed(3)}ms | ${fuzzysort.peakMemoryMB.toFixed(2)}MB (baseline)`,
    )
    console.log(
      `    Rust (skim):         ${skim.avgTimeMs.toFixed(3)}ms | ${skim.peakMemoryMB.toFixed(2)}MB (${skimSpeedup}x)`,
    )
    console.log(
      `    Rust (nucleo):       ${nucleo.avgTimeMs.toFixed(3)}ms | ${nucleo.peakMemoryMB.toFixed(2)}MB (${nucleoSpeedup}x)`,
    )
    console.log(
      `    Rust (sublime):      ${sublime.avgTimeMs.toFixed(3)}ms | ${sublime.peakMemoryMB.toFixed(2)}MB (${sublimeSpeedup}x)`,
    )

    // Determine winner (by time)
    const times = [
      { name: "fuzzysort (JS)", time: fuzzysort.avgTimeMs, mem: fuzzysort.peakMemoryMB },
      { name: "Rust (skim)", time: skim.avgTimeMs, mem: skim.peakMemoryMB },
      { name: "Rust (nucleo)", time: nucleo.avgTimeMs, mem: nucleo.peakMemoryMB },
      { name: "Rust (sublime)", time: sublime.avgTimeMs, mem: sublime.peakMemoryMB },
    ]
    const fastest = times.reduce((min, curr) => (curr.time < min.time ? curr : min))
    const lowestMem = times.reduce((min, curr) => (curr.mem < min.mem ? curr : min))
    console.log(`    ⚡ Fastest: ${fastest.name}`)
    console.log(`    💾 Lowest memory: ${lowestMem.name}`)
  }

  console.log()
}

console.log("=".repeat(80))
console.log("✅ Benchmark complete!")
console.log()
console.log("📝 Notes:")
console.log("  - Time: Lower is better")
console.log("  - Memory: Lower is better (peak heap allocation during benchmark)")
console.log("  - Speedup >1.0x means Rust is faster than JS")
console.log("  - Speedup <1.0x means JS is faster than Rust")
console.log("  - All results are averaged over 100 iterations")
console.log()
console.log("💡 To enable GC during benchmark, run: bun --expose-gc script/bench-fuzzy-all.ts")
