#!/usr/bin/env bun
/**
 * VCS operations benchmark - TypeScript pattern vs Rust FFI
 * Compares old git spawning approach vs new native implementation
 */

import { getVcsInfoFFI } from "../packages/ironcode/src/tool/ffi"
import { $ } from "bun"
import { performance } from "perf_hooks"

interface BenchResult {
  avgTime: number
  minTime: number
  maxTime: number
  times: number[]
}

// Old TypeScript pattern - spawning git processes
async function oldTypeScriptPattern(cwd: string) {
  // First call: get branch
  const branch = await $`git rev-parse --abbrev-ref HEAD`
    .quiet()
    .nothrow()
    .cwd(cwd)
    .text()
    .then((x) => x.trim())
    .catch(() => undefined)

  // Second call: get status
  const output = await $`git status --porcelain`.quiet().nothrow().cwd(cwd).text()
  const lines = output
    .trim()
    .split("\n")
    .filter((line) => line.trim())

  let added = 0
  let modified = 0
  let deleted = 0

  for (const line of lines) {
    const status = line.substring(0, 2)
    if (status.includes("?") || status.includes("A")) added++
    else if (status.includes("M")) modified++
    else if (status.includes("D")) deleted++
  }

  return { branch, added, modified, deleted }
}

// New Rust FFI implementation
function newRustFFI(cwd: string) {
  return getVcsInfoFFI(cwd)
}

async function benchmark(name: string, fn: () => any, iterations: number): Promise<BenchResult> {
  const times: number[] = []

  // Warmup
  for (let i = 0; i < 5; i++) {
    await fn()
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  times.sort((a, b) => a - b)

  return {
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: times[0],
    maxTime: times[times.length - 1],
    times,
  }
}

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} µs`
  return `${ms.toFixed(2)} ms`
}

async function main() {
  console.log("🔥 VCS Operations Benchmark")
  console.log("=".repeat(80))
  console.log("Comparing old git spawning vs new native Rust implementation\n")

  const cwd = process.cwd()
  console.log(`📍 Repository: ${cwd}`)

  // Verify we're in a git repo
  const info = getVcsInfoFFI(cwd)
  if (!info) {
    console.error("❌ Not a git repository!")
    process.exit(1)
  }

  console.log(`📊 Current Status:`)
  console.log(`   Branch: ${info.branch}`)
  if (info.added) console.log(`   Added: ${info.added}`)
  if (info.modified) console.log(`   Modified: ${info.modified}`)
  if (info.deleted) console.log(`   Deleted: ${info.deleted}`)

  console.log("\n⏱️  Running benchmarks (100 iterations each)...\n")

  const iterations = 100

  // Benchmark old pattern
  console.log("📝 Old Pattern (2x git spawning):")
  const oldResult = await benchmark("old-pattern", () => oldTypeScriptPattern(cwd), iterations)
  console.log(`   Average: ${formatTime(oldResult.avgTime)}`)
  console.log(`   Min:     ${formatTime(oldResult.minTime)}`)
  console.log(`   Max:     ${formatTime(oldResult.maxTime)}`)
  console.log(`   Median:  ${formatTime(oldResult.times[Math.floor(oldResult.times.length / 2)])}`)

  console.log("\n🦀 New Pattern (Rust FFI with libgit2):")
  const newResult = await benchmark("new-pattern", () => newRustFFI(cwd), iterations)
  console.log(`   Average: ${formatTime(newResult.avgTime)}`)
  console.log(`   Min:     ${formatTime(newResult.minTime)}`)
  console.log(`   Max:     ${formatTime(newResult.maxTime)}`)
  console.log(`   Median:  ${formatTime(newResult.times[Math.floor(newResult.times.length / 2)])}`)

  // Calculate improvements
  const speedup = oldResult.avgTime / newResult.avgTime
  const improvement = ((oldResult.avgTime - newResult.avgTime) / oldResult.avgTime) * 100
  const timeSaved = oldResult.avgTime - newResult.avgTime

  console.log("\n📈 Performance Comparison:")
  console.log(`   Speedup:        ${speedup.toFixed(2)}x faster`)
  console.log(`   Improvement:    ${improvement.toFixed(1)}% reduction`)
  console.log(`   Time saved:     ${formatTime(timeSaved)} per call`)
  console.log(`   Time saved/100: ${formatTime(timeSaved * 100)} per 100 calls`)

  // Calculate percentiles
  function percentile(arr: number[], p: number): number {
    const index = Math.ceil((arr.length * p) / 100) - 1
    return arr[index]
  }

  console.log("\n📊 Latency Distribution (old pattern):")
  console.log(`   p50: ${formatTime(percentile(oldResult.times, 50))}`)
  console.log(`   p90: ${formatTime(percentile(oldResult.times, 90))}`)
  console.log(`   p95: ${formatTime(percentile(oldResult.times, 95))}`)
  console.log(`   p99: ${formatTime(percentile(oldResult.times, 99))}`)

  console.log("\n📊 Latency Distribution (new pattern):")
  console.log(`   p50: ${formatTime(percentile(newResult.times, 50))}`)
  console.log(`   p90: ${formatTime(percentile(newResult.times, 90))}`)
  console.log(`   p95: ${formatTime(percentile(newResult.times, 95))}`)
  console.log(`   p99: ${formatTime(percentile(newResult.times, 99))}`)

  console.log("\n" + "=".repeat(80))
  console.log("\n✅ Benchmark Complete!")
  console.log("\nKey Takeaways:")
  console.log("- Native Rust eliminates process spawning overhead")
  console.log("- Single libgit2 call vs 2 separate git commands")
  console.log("- More consistent performance (lower variance)")
  console.log("- Better for high-frequency operations (file watching, status checks)")
}

main()
