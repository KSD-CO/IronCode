#!/usr/bin/env bun

/**
 * Benchmark: Native Rust file listing vs. Ripgrep process spawn
 *
 * Measures performance of:
 * 1. Native Rust FFI file listing (using ignore crate)
 * 2. Original Bun.spawn ripgrep implementation
 *
 * Tests on the IronCode repository to get real-world results.
 */

import { fileListFFI } from "../src/tool/ffi"
import { $ } from "bun"
import path from "path"
import { Ripgrep } from "../src/file/ripgrep"

// Get repo root (packages/ironcode parent)
const repoRoot = path.resolve(import.meta.dir, "../../..")

interface BenchmarkResult {
  name: string
  avgTime: number
  minTime: number
  maxTime: number
  totalFiles: number
}

async function benchmarkNativeRust(iterations: number = 10): Promise<BenchmarkResult> {
  const times: number[] = []
  let totalFiles = 0

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    const files = fileListFFI(
      repoRoot,
      ["!.git/*"], // Exclude .git
      true, // Show hidden files
      false, // Don't follow symlinks
      undefined, // No max depth
    )
    const end = performance.now()
    times.push(end - start)
    totalFiles = files.length
  }

  return {
    name: "Native Rust FFI",
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    totalFiles,
  }
}

async function benchmarkRipgrepSpawn(iterations: number = 10): Promise<BenchmarkResult> {
  const times: number[] = []
  let totalFiles = 0

  // Use Ripgrep.filepath() to get the binary (downloads if needed)
  const rgPath = await Ripgrep.filepath()

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    const result = await $`${rgPath} --files --hidden '--glob=!.git/*'`.cwd(repoRoot).quiet()
    const files = result.text().trim().split("\n").filter(Boolean)
    const end = performance.now()
    times.push(end - start)
    totalFiles = files.length
  }

  return {
    name: "Ripgrep Spawn",
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    totalFiles,
  }
}

function formatTime(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`
  }
  return `${ms.toFixed(2)}ms`
}

async function main() {
  console.log("File Listing Benchmark")
  console.log("=".repeat(60))
  console.log(`Repository: ${repoRoot}`)
  console.log(`Iterations: 10 each\n`)

  console.log("Warming up...")
  await benchmarkNativeRust(2)
  await benchmarkRipgrepSpawn(2)
  console.log("Warm-up complete\n")

  console.log("Running benchmarks...\n")

  const nativeResult = await benchmarkNativeRust(10)
  console.log(`✅ ${nativeResult.name}`)
  console.log(`   Files found:  ${nativeResult.totalFiles}`)
  console.log(`   Average time: ${formatTime(nativeResult.avgTime)}`)
  console.log(`   Min time:     ${formatTime(nativeResult.minTime)}`)
  console.log(`   Max time:     ${formatTime(nativeResult.maxTime)}`)
  console.log()

  const ripgrepResult = await benchmarkRipgrepSpawn(10)
  console.log(`📦 ${ripgrepResult.name}`)
  console.log(`   Files found:  ${ripgrepResult.totalFiles}`)
  console.log(`   Average time: ${formatTime(ripgrepResult.avgTime)}`)
  console.log(`   Min time:     ${formatTime(ripgrepResult.minTime)}`)
  console.log(`   Max time:     ${formatTime(ripgrepResult.maxTime)}`)
  console.log()

  // Calculate speedup
  const speedup = ripgrepResult.avgTime / nativeResult.avgTime
  console.log("=".repeat(60))
  console.log(`🚀 Speedup: ${speedup.toFixed(2)}x faster with native Rust`)
  console.log(`   Time saved: ${formatTime(ripgrepResult.avgTime - nativeResult.avgTime)} per call`)

  if (speedup > 1.5) {
    console.log(`   ✅ SUCCESS: Native Rust is ${speedup.toFixed(1)}x faster!`)
  } else if (speedup > 1) {
    console.log(`   ⚠️  MARGINAL: Only ${speedup.toFixed(1)}x faster (expected 2-3x)`)
  } else {
    console.log(`   ❌ SLOWER: Native Rust is slower than ripgrep spawn`)
  }
}

main().catch(console.error)
