#!/usr/bin/env bun
/**
 * Benchmark: Lock operations (TypeScript vs Rust FFI)
 *
 * Tests:
 * 1. Single read lock acquire/release
 * 2. Multiple concurrent readers
 * 3. Writer exclusivity
 * 4. Mixed read/write workload
 *
 * Run: bun script/bench-lock.ts
 */

import { LockJS } from "../packages/ironcode/src/util/lock-js"
import { LockNative } from "../packages/ironcode/src/util/lock-native"

// Warm up
async function warmup() {
  for (let i = 0; i < 10; i++) {
    {
      using _ = await LockJS.read("warmup-js")
    }
    {
      using _ = await LockNative.read("warmup-native")
    }
  }
}

// Benchmark helper
async function benchmark(name: string, fn: () => Promise<void>, iterations: number) {
  const times: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    const end = performance.now()
    times.push(end - start)
  }

  const avg = times.reduce((a, b) => a + b) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  const sorted = times.sort((a, b) => a - b)
  const p50 = sorted[Math.floor(sorted.length * 0.5)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]

  console.log(`${name}:`)
  console.log(`  Average: ${avg.toFixed(4)}ms`)
  console.log(`  Min:     ${min.toFixed(4)}ms`)
  console.log(`  Max:     ${max.toFixed(4)}ms`)
  console.log(`  P50:     ${p50.toFixed(4)}ms`)
  console.log(`  P95:     ${p95.toFixed(4)}ms`)

  return { avg, min, max, p50, p95 }
}

// Test 1: Single read lock
async function testSingleReadLock(impl: typeof LockJS, key: string) {
  using _ = await impl.read(key)
}

// Test 2: Multiple concurrent readers
async function testMultipleReaders(impl: typeof LockJS, key: string, count: number) {
  const tasks: Promise<void>[] = []
  for (let i = 0; i < count; i++) {
    tasks.push(
      (async () => {
        using _ = await impl.read(key)
      })(),
    )
  }
  await Promise.all(tasks)
}

// Test 3: Writer exclusivity
async function testWriterExclusivity(impl: typeof LockJS, key: string) {
  using _ = await impl.write(key)
}

// Test 4: Mixed read/write workload
async function testMixedWorkload(impl: typeof LockJS, key: string, reads: number, writes: number) {
  const tasks: Promise<void>[] = []

  // Add read tasks
  for (let i = 0; i < reads; i++) {
    tasks.push(
      (async () => {
        using _ = await impl.read(key)
      })(),
    )
  }

  // Add write tasks
  for (let i = 0; i < writes; i++) {
    tasks.push(
      (async () => {
        using _ = await impl.write(key)
      })(),
    )
  }

  // Shuffle tasks for realistic interleaving
  tasks.sort(() => Math.random() - 0.5)
  await Promise.all(tasks)
}

async function main() {
  console.log("Lock Operations Benchmark")
  console.log("=" + "=".repeat(79))
  console.log()

  await warmup()

  const iterations = 100

  // Test 1: Single read lock
  console.log("Test 1: Single read lock acquisition (100 iterations)")
  console.log("-".repeat(80))
  const jsRead = await benchmark("JS Implementation", () => testSingleReadLock(LockJS, "test-js-1"), iterations)
  const nativeRead = await benchmark(
    "Native Rust",
    () => testSingleReadLock(LockNative as any, "test-native-1"),
    iterations,
  )
  console.log(`Speedup: ${(jsRead.avg / nativeRead.avg).toFixed(2)}x faster`)
  console.log()

  // Test 2: Multiple concurrent readers (10 readers)
  console.log("Test 2: Multiple concurrent readers - 10 readers (100 iterations)")
  console.log("-".repeat(80))
  const jsMultiRead = await benchmark(
    "JS Implementation",
    () => testMultipleReaders(LockJS, "test-js-2", 10),
    iterations,
  )
  const nativeMultiRead = await benchmark(
    "Native Rust",
    () => testMultipleReaders(LockNative as any, "test-native-2", 10),
    iterations,
  )
  console.log(`Speedup: ${(jsMultiRead.avg / nativeMultiRead.avg).toFixed(2)}x faster`)
  console.log()

  // Test 3: Writer exclusivity
  console.log("Test 3: Writer lock acquisition (100 iterations)")
  console.log("-".repeat(80))
  const jsWrite = await benchmark("JS Implementation", () => testWriterExclusivity(LockJS, "test-js-3"), iterations)
  const nativeWrite = await benchmark(
    "Native Rust",
    () => testWriterExclusivity(LockNative as any, "test-native-3"),
    iterations,
  )
  console.log(`Speedup: ${(jsWrite.avg / nativeWrite.avg).toFixed(2)}x faster`)
  console.log()

  // Test 4: Mixed read/write workload (7 reads, 3 writes)
  console.log("Test 4: Mixed read/write workload - 7 reads, 3 writes (100 iterations)")
  console.log("-".repeat(80))
  const jsMixed = await benchmark("JS Implementation", () => testMixedWorkload(LockJS, "test-js-4", 7, 3), iterations)
  const nativeMixed = await benchmark(
    "Native Rust",
    () => testMixedWorkload(LockNative as any, "test-native-4", 7, 3),
    iterations,
  )
  console.log(`Speedup: ${(jsMixed.avg / nativeMixed.avg).toFixed(2)}x faster`)
  console.log()

  // Summary
  console.log("=" + "=".repeat(79))
  console.log("Summary")
  console.log("-".repeat(80))
  const avgSpeedup =
    (jsRead.avg / nativeRead.avg +
      jsMultiRead.avg / nativeMultiRead.avg +
      jsWrite.avg / nativeWrite.avg +
      jsMixed.avg / nativeMixed.avg) /
    4
  console.log(`Average Speedup: ${avgSpeedup.toFixed(2)}x`)
  console.log()
  console.log("Breakdown:")
  console.log(`  Single Read:       ${(jsRead.avg / nativeRead.avg).toFixed(2)}x faster`)
  console.log(`  Multiple Readers:  ${(jsMultiRead.avg / nativeMultiRead.avg).toFixed(2)}x faster`)
  console.log(`  Single Write:      ${(jsWrite.avg / nativeWrite.avg).toFixed(2)}x faster`)
  console.log(`  Mixed Workload:    ${(jsMixed.avg / nativeMixed.avg).toFixed(2)}x faster`)
}

main().catch(console.error)
