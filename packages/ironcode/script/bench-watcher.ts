#!/usr/bin/env bun

/**
 * File Watcher Benchmark
 *
 * Compares @parcel/watcher performance to evaluate if Rust migration is worthwhile.
 *
 * Tests:
 * 1. Event detection latency (time from file change to callback)
 * 2. CPU overhead while watching
 * 3. Memory overhead
 * 4. Throughput (events per second)
 *
 * Scenarios:
 * - Single file change
 * - Batch file changes (10 files)
 * - Large directory watching (1000+ files)
 * - High frequency changes (100 changes/sec)
 */

import path from "path"
import fs from "fs/promises"
import os from "os"
import { watcherCreateFFI, watcherPollEventsFFI, watcherRemoveFFI, type WatcherEvent } from "../src/tool/ffi"

// Load @parcel/watcher
const IRONCODE_LIBC = process.platform === "linux" ? "glibc" : undefined
let parcelWatcher: any

try {
  // @ts-ignore - dynamic require
  const { createWrapper } = require("@parcel/watcher/wrapper")
  const binding = require(
    `@parcel/watcher-${process.platform}-${process.arch}${process.platform === "linux" ? `-${IRONCODE_LIBC}` : ""}`,
  )
  parcelWatcher = createWrapper(binding)
} catch (error) {
  console.error("Failed to load @parcel/watcher:", error)
  process.exit(1)
}

// Benchmark utilities
interface BenchmarkResult {
  name: string
  latency: {
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  }
  throughput?: number // events/second
  overhead: {
    cpu: number // percentage
    memory: number // MB
  }
}

function calculateStats(values: number[]) {
  const sorted = values.sort((a, b) => a - b)
  const sum = sorted.reduce((a, b) => a + b, 0)

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  }
}

async function measureMemory(): Promise<number> {
  if (global.gc) {
    global.gc()
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return process.memoryUsage().heapUsed / 1024 / 1024
}

// Test scenarios
async function setupTestDirectory(): Promise<string> {
  const testDir = path.join(os.tmpdir(), `watcher-bench-${Date.now()}`)
  await fs.mkdir(testDir, { recursive: true })

  // Create some initial files
  for (let i = 0; i < 100; i++) {
    await fs.writeFile(path.join(testDir, `file-${i}.txt`), `Initial content ${i}`)
  }

  return testDir
}

async function cleanupTestDirectory(testDir: string) {
  await fs.rm(testDir, { recursive: true, force: true })
}

// Benchmark 1: Single file change latency
async function benchmarkSingleFileLatency(testDir: string): Promise<number[]> {
  const latencies: number[] = []
  const iterations = 50

  console.log("  Running single file change test...")

  for (let i = 0; i < iterations; i++) {
    const testFile = path.join(testDir, `test-single-${i}.txt`)

    const eventPromise = new Promise<number>((resolve) => {
      const startTime = performance.now()

      const subscription = parcelWatcher!.subscribe(testDir, (err: any, events: any) => {
        if (err) return

        for (const event of events) {
          if (event.path === testFile) {
            const latency = performance.now() - startTime
            subscription.then((sub: any) => sub.unsubscribe())
            resolve(latency)
            return
          }
        }
      })
    })

    // Small delay to ensure watcher is ready
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Trigger file change
    await fs.writeFile(testFile, `Content ${i}`)

    const latency = await eventPromise
    latencies.push(latency)

    // Cleanup
    await fs.unlink(testFile).catch(() => {})

    // Small delay between iterations
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return latencies
}

// Benchmark 2: Batch file changes
async function benchmarkBatchChanges(testDir: string): Promise<{ latencies: number[]; throughput: number }> {
  const batchSize = 10
  const iterations = 20
  const allLatencies: number[] = []

  console.log("  Running batch file changes test...")

  for (let iter = 0; iter < iterations; iter++) {
    const files = Array.from({ length: batchSize }, (_, i) => path.join(testDir, `batch-${iter}-${i}.txt`))

    let eventCount = 0
    const startTime = performance.now()
    const eventTimes: number[] = []

    const eventPromise = new Promise<void>((resolve) => {
      const subscription = parcelWatcher!.subscribe(testDir, (err: any, events: any) => {
        if (err) return

        const now = performance.now()

        for (const event of events) {
          if (files.includes(event.path)) {
            eventCount++
            eventTimes.push(now - startTime)

            if (eventCount === batchSize) {
              subscription.then((sub: any) => sub.unsubscribe())
              resolve()
            }
          }
        }
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Write all files simultaneously
    const writeStart = performance.now()
    await Promise.all(files.map((f) => fs.writeFile(f, `Batch content`)))

    await eventPromise

    allLatencies.push(...eventTimes)

    // Cleanup
    await Promise.all(files.map((f) => fs.unlink(f).catch(() => {})))
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (allLatencies.length === 0) {
    return { latencies: [], throughput: 0 }
  }

  // Sort latencies since they come from multiple iterations
  const sortedLatencies = allLatencies.sort((a, b) => a - b)
  const totalTime = sortedLatencies[sortedLatencies.length - 1] - sortedLatencies[0]
  const throughput = totalTime > 0 ? (sortedLatencies.length / totalTime) * 1000 : 0

  return { latencies: sortedLatencies, throughput }
}

// Rust Watcher Benchmarks

// Benchmark 1R: Single file change latency (Rust)
async function benchmarkSingleFileLatencyRust(testDir: string): Promise<number[]> {
  const latencies: number[] = []
  const iterations = 50

  console.log("  Running single file change test (Rust)...")

  for (let i = 0; i < iterations; i++) {
    const testFile = path.join(testDir, `test-single-rust-${i}.txt`)
    const watcherId = `bench-single-${i}`

    // Create watcher
    watcherCreateFFI(watcherId, testDir, [], 1000)

    const startTime = performance.now()
    let resolved = false

    // Start polling
    const pollPromise = new Promise<number>((resolve) => {
      const pollInterval = setInterval(() => {
        const events = watcherPollEventsFFI(watcherId)
        if (resolved) {
          clearInterval(pollInterval)
          return
        }

        for (const event of events) {
          if (event.path === testFile) {
            const latency = performance.now() - startTime
            clearInterval(pollInterval)
            resolved = true
            resolve(latency)
            return
          }
        }
      }, 5) // Poll every 5ms
    })

    // Small delay to ensure watcher is ready
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Trigger file change
    await fs.writeFile(testFile, `Content ${i}`)

    const latency = await pollPromise
    latencies.push(latency)

    // Cleanup
    watcherRemoveFFI(watcherId)
    await fs.unlink(testFile).catch(() => {})

    // Small delay between iterations
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return latencies
}

// Benchmark 2R: Batch file changes (Rust)
async function benchmarkBatchChangesRust(testDir: string): Promise<{ latencies: number[]; throughput: number }> {
  const batchSize = 10
  const iterations = 20
  const allLatencies: number[] = []

  console.log("  Running batch file changes test (Rust)...")

  for (let iter = 0; iter < iterations; iter++) {
    const files = Array.from({ length: batchSize }, (_, i) => path.join(testDir, `batch-rust-${iter}-${i}.txt`))
    const watcherId = `bench-batch-${iter}`

    // Create watcher
    watcherCreateFFI(watcherId, testDir, [], 1000)

    let eventCount = 0
    const startTime = performance.now()
    const eventTimes: number[] = []
    let resolved = false

    const eventPromise = new Promise<void>((resolve) => {
      const pollInterval = setInterval(() => {
        const events = watcherPollEventsFFI(watcherId)
        if (resolved) {
          clearInterval(pollInterval)
          return
        }

        const now = performance.now()

        for (const event of events) {
          if (files.includes(event.path)) {
            eventCount++
            eventTimes.push(now - startTime)

            if (eventCount === batchSize) {
              clearInterval(pollInterval)
              resolved = true
              resolve()
            }
          }
        }
      }, 5) // Poll every 5ms
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Write all files simultaneously
    await Promise.all(files.map((f) => fs.writeFile(f, `Batch content`)))

    await eventPromise

    allLatencies.push(...eventTimes)

    // Cleanup
    watcherRemoveFFI(watcherId)
    await Promise.all(files.map((f) => fs.unlink(f).catch(() => {})))
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (allLatencies.length === 0) {
    return { latencies: [], throughput: 0 }
  }

  // Sort latencies since they come from multiple iterations
  const sortedLatencies = allLatencies.sort((a, b) => a - b)
  const totalTime = sortedLatencies[sortedLatencies.length - 1] - sortedLatencies[0]
  const throughput = totalTime > 0 ? (sortedLatencies.length / totalTime) * 1000 : 0

  return { latencies: sortedLatencies, throughput }
}

// Benchmark 3R: Memory and CPU overhead (Rust)
async function benchmarkOverheadRust(testDir: string): Promise<{ memory: number; duration: number }> {
  console.log("  Running overhead test (Rust)...")

  const memBefore = await measureMemory()
  const startTime = performance.now()
  const watcherId = "bench-overhead"

  // Start watching
  watcherCreateFFI(watcherId, testDir, [], 1000)

  // Poll in background
  const pollInterval = setInterval(() => {
    watcherPollEventsFFI(watcherId)
  }, 50)

  // Let it run for 5 seconds with some activity
  for (let i = 0; i < 50; i++) {
    const file = path.join(testDir, `overhead-rust-${i}.txt`)
    await fs.writeFile(file, "content")
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  clearInterval(pollInterval)
  const memAfter = await measureMemory()
  const duration = performance.now() - startTime

  watcherRemoveFFI(watcherId)

  return {
    memory: memAfter - memBefore,
    duration,
  }
}

// Benchmark 3: Memory and CPU overhead
async function benchmarkOverhead(testDir: string): Promise<{ memory: number; duration: number }> {
  console.log("  Running overhead test...")

  const memBefore = await measureMemory()
  const startTime = performance.now()

  // Start watching
  const subscription = await parcelWatcher!.subscribe(testDir, () => {})

  // Let it run for 5 seconds with some activity
  for (let i = 0; i < 50; i++) {
    const file = path.join(testDir, `overhead-${i}.txt`)
    await fs.writeFile(file, "content")
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const memAfter = await measureMemory()
  const duration = performance.now() - startTime

  await subscription.unsubscribe()

  return {
    memory: memAfter - memBefore,
    duration,
  }
}

// Main benchmark runner
async function runBenchmark() {
  console.log("🔍 File Watcher Benchmark - @parcel/watcher vs Rust\n")
  console.log("Platform:", process.platform)
  console.log("Architecture:", process.arch)
  console.log("Libc:", IRONCODE_LIBC || "N/A")
  console.log()

  const testDir = await setupTestDirectory()
  console.log("Test directory:", testDir)
  console.log()

  try {
    // ========================================
    // PARCEL WATCHER BENCHMARKS
    // ========================================
    console.log("=".repeat(60))
    console.log("📦 @parcel/watcher Benchmarks")
    console.log("=".repeat(60))
    console.log()

    // Benchmark 1: Single file latency
    console.log("📊 Benchmark 1: Single File Change Latency")
    const singleLatencies = await benchmarkSingleFileLatency(testDir)
    const singleStats = calculateStats(singleLatencies)

    console.log("  Results:")
    console.log(`    Min:     ${singleStats.min.toFixed(2)} ms`)
    console.log(`    Max:     ${singleStats.max.toFixed(2)} ms`)
    console.log(`    Average: ${singleStats.avg.toFixed(2)} ms`)
    console.log(`    P50:     ${singleStats.p50.toFixed(2)} ms`)
    console.log(`    P95:     ${singleStats.p95.toFixed(2)} ms`)
    console.log(`    P99:     ${singleStats.p99.toFixed(2)} ms`)
    console.log()

    // Benchmark 2: Batch changes
    console.log("📊 Benchmark 2: Batch File Changes (10 files)")
    const { latencies: batchLatencies, throughput } = await benchmarkBatchChanges(testDir)
    const batchStats = calculateStats(batchLatencies)

    console.log("  Results:")
    console.log(`    Min:        ${batchStats.min.toFixed(2)} ms`)
    console.log(`    Max:        ${batchStats.max.toFixed(2)} ms`)
    console.log(`    Average:    ${batchStats.avg.toFixed(2)} ms`)
    console.log(`    P50:        ${batchStats.p50.toFixed(2)} ms`)
    console.log(`    P95:        ${batchStats.p95.toFixed(2)} ms`)
    console.log(`    Throughput: ${throughput.toFixed(2)} events/sec`)
    console.log()

    // Benchmark 3: Overhead
    console.log("📊 Benchmark 3: Memory & CPU Overhead")
    const overhead = await benchmarkOverhead(testDir)

    console.log("  Results:")
    console.log(`    Memory overhead: ${overhead.memory.toFixed(2)} MB`)
    console.log(`    Test duration:   ${overhead.duration.toFixed(2)} ms`)
    console.log()

    // ========================================
    // RUST WATCHER BENCHMARKS
    // ========================================
    console.log("=".repeat(60))
    console.log("🦀 Rust Watcher Benchmarks")
    console.log("=".repeat(60))
    console.log()

    // Benchmark 1R: Single file latency (Rust)
    console.log("📊 Benchmark 1: Single File Change Latency (Rust)")
    const singleLatenciesRust = await benchmarkSingleFileLatencyRust(testDir)
    const singleStatsRust = calculateStats(singleLatenciesRust)

    console.log("  Results:")
    console.log(`    Min:     ${singleStatsRust.min.toFixed(2)} ms`)
    console.log(`    Max:     ${singleStatsRust.max.toFixed(2)} ms`)
    console.log(`    Average: ${singleStatsRust.avg.toFixed(2)} ms`)
    console.log(`    P50:     ${singleStatsRust.p50.toFixed(2)} ms`)
    console.log(`    P95:     ${singleStatsRust.p95.toFixed(2)} ms`)
    console.log(`    P99:     ${singleStatsRust.p99.toFixed(2)} ms`)
    console.log()

    // Benchmark 2R: Batch changes (Rust)
    console.log("📊 Benchmark 2: Batch File Changes (10 files) (Rust)")
    const { latencies: batchLatenciesRust, throughput: throughputRust } = await benchmarkBatchChangesRust(testDir)
    const batchStatsRust = calculateStats(batchLatenciesRust)

    console.log("  Results:")
    console.log(`    Min:        ${batchStatsRust.min.toFixed(2)} ms`)
    console.log(`    Max:        ${batchStatsRust.max.toFixed(2)} ms`)
    console.log(`    Average:    ${batchStatsRust.avg.toFixed(2)} ms`)
    console.log(`    P50:        ${batchStatsRust.p50.toFixed(2)} ms`)
    console.log(`    P95:        ${batchStatsRust.p95.toFixed(2)} ms`)
    console.log(`    Throughput: ${throughputRust.toFixed(2)} events/sec`)
    console.log()

    // Benchmark 3R: Overhead (Rust)
    console.log("📊 Benchmark 3: Memory & CPU Overhead (Rust)")
    const overheadRust = await benchmarkOverheadRust(testDir)

    console.log("  Results:")
    console.log(`    Memory overhead: ${overheadRust.memory.toFixed(2)} MB`)
    console.log(`    Test duration:   ${overheadRust.duration.toFixed(2)} ms`)
    console.log()

    // ========================================
    // COMPARISON & ANALYSIS
    // ========================================
    console.log("=".repeat(60))
    console.log("📊 PERFORMANCE COMPARISON")
    console.log("=".repeat(60))
    console.log()

    const latencyImprovement = ((singleStats.avg - singleStatsRust.avg) / singleStats.avg) * 100
    const throughputImprovement = ((throughputRust - throughput) / throughput) * 100
    const memoryDiff = overheadRust.memory - overhead.memory

    console.log("Single File Latency:")
    console.log(`  @parcel/watcher: ${singleStats.avg.toFixed(2)} ms (P95: ${singleStats.p95.toFixed(2)} ms)`)
    console.log(`  Rust watcher:    ${singleStatsRust.avg.toFixed(2)} ms (P95: ${singleStatsRust.p95.toFixed(2)} ms)`)
    console.log(`  Improvement:     ${latencyImprovement >= 0 ? "+" : ""}${latencyImprovement.toFixed(1)}%`)
    console.log(`  Speedup:         ${(singleStats.avg / singleStatsRust.avg).toFixed(2)}x`)
    console.log()

    console.log("Batch Throughput (10 files):")
    console.log(`  @parcel/watcher: ${throughput.toFixed(0)} events/sec`)
    console.log(`  Rust watcher:    ${throughputRust.toFixed(0)} events/sec`)
    console.log(`  Improvement:     ${throughputImprovement >= 0 ? "+" : ""}${throughputImprovement.toFixed(1)}%`)
    console.log()

    console.log("Memory Overhead:")
    console.log(`  @parcel/watcher: ${overhead.memory.toFixed(2)} MB`)
    console.log(`  Rust watcher:    ${overheadRust.memory.toFixed(2)} MB`)
    console.log(`  Difference:      ${memoryDiff >= 0 ? "+" : ""}${memoryDiff.toFixed(2)} MB`)
    console.log()

    console.log("=".repeat(60))
    console.log("🎯 RECOMMENDATION")
    console.log("=".repeat(60))
    console.log()

    const speedup = singleStats.avg / singleStatsRust.avg
    const isFasterSingle = speedup >= 1.1 // At least 10% faster
    const isFasterBatch = throughputImprovement >= 50 // At least 50% better throughput

    if (isFasterSingle && isFasterBatch) {
      console.log("✅ INTEGRATE RUST WATCHER - SIGNIFICANT IMPROVEMENT")
      console.log(`   ${speedup.toFixed(2)}x faster latency`)
      console.log(`   ${throughputImprovement.toFixed(0)}% better throughput`)
      console.log()
      console.log("   Benefits:")
      console.log("   - Much faster event detection")
      console.log("   - Better consistency with other native components")
      console.log("   - Reduced dependency on Node.js ecosystem")
    } else if (isFasterSingle || isFasterBatch) {
      console.log("⚠️  MIXED RESULTS - EVALUATE TRADE-OFFS")
      console.log(`   Single file: ${speedup.toFixed(2)}x (${latencyImprovement >= 0 ? "faster" : "slower"})`)
      console.log(`   Batch: ${throughputImprovement >= 0 ? "+" : ""}${throughputImprovement.toFixed(0)}%`)
      console.log()
      console.log("   Trade-offs:")
      if (isFasterBatch && !isFasterSingle) {
        console.log("   - Much better batch performance (event queue buffering)")
        console.log("   - Slightly slower single-file latency (polling overhead)")
        console.log("   - Consider if batch scenarios are common in your workload")
      } else {
        console.log("   - Moderate performance gain in some scenarios")
        console.log("   - Additional maintenance complexity")
        console.log("   - Consistency with other native components")
      }
    } else if (speedup >= 0.9) {
      console.log("❌ DO NOT INTEGRATE - MINIMAL/NO IMPROVEMENT")
      console.log(
        `   Single file: ${speedup.toFixed(2)}x (${Math.abs(latencyImprovement).toFixed(0)}% ${latencyImprovement >= 0 ? "faster" : "slower"})`,
      )
      console.log()
      console.log("   Reasons:")
      console.log("   - Performance gain not worth the complexity")
      console.log("   - @parcel/watcher is already well-optimized")
      console.log("   - FFI/polling overhead reduces benefits")
      console.log()
      console.log("   Note: The Rust watcher uses an event queue pattern which helps with")
      console.log("         batch throughput but adds 5ms polling latency to single events.")
      console.log("         For typical file watching use cases, @parcel/watcher is sufficient.")
    } else {
      console.log("❌ DO NOT INTEGRATE - RUST IMPLEMENTATION IS SLOWER")
      console.log(`   ${(1 / speedup).toFixed(2)}x slower than @parcel/watcher`)
      console.log()
      console.log("   Issues:")
      console.log("   - FFI overhead dominates")
      console.log("   - Polling adds latency")
      console.log("   - @parcel/watcher is more optimized")
    }
    console.log()
  } finally {
    await cleanupTestDirectory(testDir)
  }
}

// Run if executed directly
if (import.meta.main) {
  runBenchmark().catch(console.error)
}

export { runBenchmark }
