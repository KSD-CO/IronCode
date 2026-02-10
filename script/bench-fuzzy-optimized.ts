#!/usr/bin/env bun
/**
 * Benchmark: Fuzzy Search - 3-way comparison
 *
 * Compares performance of:
 * 1. fuzzysort (JavaScript) - baseline
 * 2. Rust FFI with JSON - slow due to serialization overhead
 * 3. Rust FFI with raw strings - optimized, zero JSON overhead
 */

import { fuzzySearchFFI, fuzzySearchRawFFI } from "../packages/ironcode/src/tool/ffi"
// @ts-ignore - fuzzysort doesn't have types
const fuzzysort = await import("fuzzysort").then((m) => m.default || m)

// Generate realistic file paths for testing
function generateFilePaths(count: number): string[] {
  const dirs = ["src", "test", "dist", "node_modules", "packages", "components", "utils", "lib", "bin"]
  const files = [
    "index.ts",
    "main.ts",
    "test.ts",
    "App.tsx",
    "Button.tsx",
    "utils.ts",
    "config.json",
    "README.md",
    "package.json",
  ]
  const extensions = [".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css"]

  const paths: string[] = []
  for (let i = 0; i < count; i++) {
    const depth = Math.floor(Math.random() * 4) + 1
    let path = ""
    for (let d = 0; d < depth - 1; d++) {
      path += dirs[Math.floor(Math.random() * dirs.length)] + "/"
    }
    const filename = files[Math.floor(Math.random() * files.length)]
    path += filename.replace(/\.\w+$/, "") + extensions[Math.floor(Math.random() * extensions.length)]
    paths.push(path)
  }
  return paths
}

// Calculate percentiles
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((sorted.length * p) / 100) - 1
  return sorted[Math.max(0, index)]
}

// Detailed latency distribution benchmark
function benchmarkDetailed(
  name: string,
  fn: () => void,
  iterations: number = 100,
): { avg: number; min: number; max: number; p50: number; p90: number; p95: number; p99: number } {
  // Warmup
  for (let i = 0; i < 10; i++) fn()

  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    const end = performance.now()
    times.push(end - start)
  }

  return {
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
    p50: percentile(times, 50),
    p90: percentile(times, 90),
    p95: percentile(times, 95),
    p99: percentile(times, 99),
  }
}

console.log("🔥 Fuzzy Search Benchmark: 3-way Comparison\n")
console.log("=".repeat(80))

// Test scenarios
const scenarios = [
  { name: "Small (100 files)", count: 100, query: "src" },
  { name: "Medium (1K files)", count: 1000, query: "comp" },
  { name: "Large (5K files)", count: 5000, query: "test" },
  { name: "Very Large (10K files)", count: 10000, query: "util" },
]

for (const scenario of scenarios) {
  console.log(`\n📁 ${scenario.name} - Query: "${scenario.query}"`)
  console.log("-".repeat(80))

  const files = generateFilePaths(scenario.count)
  const limit = 50

  // Benchmark fuzzysort (baseline)
  const fuzzysortStats = benchmarkDetailed(
    "fuzzysort",
    () => {
      fuzzysort.go(scenario.query, files, { limit }).map((r: any) => r.target)
    },
    100,
  )

  // Benchmark Rust FFI with JSON (slow)
  const rustJsonStats = benchmarkDetailed(
    "Rust FFI (JSON)",
    () => {
      fuzzySearchFFI(scenario.query, files, limit)
    },
    100,
  )

  // Benchmark Rust FFI with raw strings (optimized)
  const rustRawStats = benchmarkDetailed(
    "Rust FFI (Raw)",
    () => {
      fuzzySearchRawFFI(scenario.query, files, limit)
    },
    100,
  )

  const speedupJson = fuzzysortStats.avg / rustJsonStats.avg
  const speedupRaw = fuzzysortStats.avg / rustRawStats.avg

  console.log(`  📊 Results:`)
  console.log(`    fuzzysort (JS):     ${fuzzysortStats.avg.toFixed(2)} ms avg`)
  console.log(`    Rust FFI (JSON):    ${rustJsonStats.avg.toFixed(2)} ms avg (${speedupJson.toFixed(2)}x)`)
  console.log(`    Rust FFI (Raw):     ${rustRawStats.avg.toFixed(2)} ms avg (${speedupRaw.toFixed(2)}x)`)

  if (speedupRaw > 1) {
    const percentGain = ((speedupRaw - 1) * 100).toFixed(1)
    console.log(`  ✅ Rust Raw wins: ${speedupRaw.toFixed(2)}x faster (+${percentGain}% improvement)`)
  } else {
    const percentLoss = ((1 - speedupRaw) * 100).toFixed(1)
    console.log(`  ❌ fuzzysort wins: ${(1 / speedupRaw).toFixed(2)}x faster (+${percentLoss}% better)`)
  }

  console.log(`\n  Latency distribution:`)
  console.log(`    Metric      fuzzysort    Rust(JSON)   Rust(Raw)`)
  console.log(`    ------      ---------    ----------   ---------`)
  console.log(
    `    min         ${fuzzysortStats.min.toFixed(2)}ms       ${rustJsonStats.min.toFixed(2)}ms       ${rustRawStats.min.toFixed(2)}ms`,
  )
  console.log(
    `    p50         ${fuzzysortStats.p50.toFixed(2)}ms       ${rustJsonStats.p50.toFixed(2)}ms       ${rustRawStats.p50.toFixed(2)}ms`,
  )
  console.log(
    `    p90         ${fuzzysortStats.p90.toFixed(2)}ms       ${rustJsonStats.p90.toFixed(2)}ms       ${rustRawStats.p90.toFixed(2)}ms`,
  )
  console.log(
    `    p99         ${fuzzysortStats.p99.toFixed(2)}ms       ${rustJsonStats.p99.toFixed(2)}ms       ${rustRawStats.p99.toFixed(2)}ms`,
  )
  console.log(
    `    max         ${fuzzysortStats.max.toFixed(2)}ms       ${rustJsonStats.max.toFixed(2)}ms       ${rustRawStats.max.toFixed(2)}ms`,
  )
}

console.log("\n" + "=".repeat(80))
console.log("✅ Benchmark complete!")
console.log("\nKey Findings:")
console.log("- JSON serialization adds significant overhead to FFI calls")
console.log("- Raw string passing (newline-separated) avoids JSON overhead")
console.log("- Optimization matters: right approach can make FFI competitive or superior")
