#!/usr/bin/env bun
/**
 * Benchmark: Fuzzy Search (fuzzysort vs Rust FFI)
 *
 * Compares performance of:
 * - Old: fuzzysort npm package (JavaScript)
 * - New: fuzzy-matcher Rust crate via FFI
 *
 * Tests multiple scenarios with real-world file paths
 */

import { fuzzySearchFFI } from "../packages/ironcode/src/tool/ffi"
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

// Benchmark function
function benchmark(name: string, fn: () => void, iterations: number = 100): number {
  // Warmup
  for (let i = 0; i < 10; i++) fn()

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const end = performance.now()
  const total = end - start
  const avg = total / iterations
  return avg
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

console.log("🔥 Fuzzy Search Benchmark: fuzzysort vs Rust FFI\n")
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

  // Benchmark fuzzysort (old)
  const fuzzysortStats = benchmarkDetailed(
    "fuzzysort",
    () => {
      fuzzysort.go(scenario.query, files, { limit }).map((r) => r.target)
    },
    100,
  )

  // Benchmark Rust FFI (new)
  const rustStats = benchmarkDetailed(
    "Rust FFI",
    () => {
      fuzzySearchFFI(scenario.query, files, limit)
    },
    100,
  )

  const speedup = fuzzysortStats.avg / rustStats.avg
  const timeSaved = fuzzysortStats.avg - rustStats.avg
  const percentReduction = ((timeSaved / fuzzysortStats.avg) * 100).toFixed(1)

  console.log(`  fuzzysort (old):  ${fuzzysortStats.avg.toFixed(2)} ms avg`)
  console.log(`  Rust FFI (new):   ${rustStats.avg.toFixed(2)} ms avg`)
  console.log(`  ⚡ ${speedup.toFixed(2)}x faster (${percentReduction}% reduction)`)
  console.log(`  💾 Time saved: ${timeSaved.toFixed(2)} ms per search`)

  console.log(`\n  Latency distribution (fuzzysort):`)
  console.log(`    min: ${fuzzysortStats.min.toFixed(2)} ms`)
  console.log(`    p50: ${fuzzysortStats.p50.toFixed(2)} ms`)
  console.log(`    p90: ${fuzzysortStats.p90.toFixed(2)} ms`)
  console.log(`    p95: ${fuzzysortStats.p95.toFixed(2)} ms`)
  console.log(`    p99: ${fuzzysortStats.p99.toFixed(2)} ms`)
  console.log(`    max: ${fuzzysortStats.max.toFixed(2)} ms`)

  console.log(`\n  Latency distribution (Rust FFI):`)
  console.log(`    min: ${rustStats.min.toFixed(2)} ms`)
  console.log(`    p50: ${rustStats.p50.toFixed(2)} ms`)
  console.log(`    p90: ${rustStats.p90.toFixed(2)} ms`)
  console.log(`    p95: ${rustStats.p95.toFixed(2)} ms`)
  console.log(`    p99: ${rustStats.p99.toFixed(2)} ms`)
  console.log(`    max: ${rustStats.max.toFixed(2)} ms`)
}

console.log("\n" + "=".repeat(80))
console.log("✅ Benchmark complete!")
console.log("\nNote: These benchmarks measure fuzzy search performance on generated file paths.")
console.log("Real-world performance may vary based on actual file structure and query patterns.")
