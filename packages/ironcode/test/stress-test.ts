#!/usr/bin/env bun
/**
 * Stress test for IronCode resource monitor
 * Simulates heavy load with multiple concurrent operations
 */

import { Resource } from "../src/util/resource"
import { Log } from "../src/util/log"

await Log.init({ print: true, dev: true, level: "INFO" })

const log = Log.create({ service: "stress-test" })

// Configure with low limit to trigger throttling
Resource.configure({
  maxMemoryMB: 300,
  checkIntervalMs: 2000,
})

Resource.start()

log.info("🔥 Stress Test Started")
log.info("Will simulate heavy workload with concurrent operations")

const stats = {
  iterations: 0,
  throttledCount: 0,
  normalCount: 0,
  warningCount: 0,
  criticalCount: 0,
  startTime: Date.now(),
  peakMemory: 0,
}

// Simulate heavy processing with multiple data structures
const heavyData: any[] = []

async function heavyOperation(id: number) {
  const status = Resource.status()

  if (status.isThrottled) {
    stats.throttledCount++
    log.warn(`Operation ${id} throttled`, {
      memory: status.memoryMB,
      level: status.level,
    })
  } else {
    stats.normalCount++
  }

  if (status.level === "warning") stats.warningCount++
  if (status.level === "critical") stats.criticalCount++
  if (status.memoryMB > stats.peakMemory) stats.peakMemory = status.memoryMB

  // Allocate some memory
  const data = new Array(1024 * 100).fill(Math.random()) // ~1MB
  heavyData.push(data)

  // Simulate processing
  await Resource.delay(50)

  // Clean up some old data
  if (heavyData.length > 50) {
    heavyData.shift()
  }

  stats.iterations++
}

// Run concurrent operations
log.info("Starting concurrent operations...")

const promises: Promise<void>[] = []
const totalOps = 100

for (let i = 0; i < totalOps; i++) {
  // Launch 5 operations concurrently
  if (i % 5 === 0 && i > 0) {
    await Promise.all(promises.splice(0, promises.length))

    const status = Resource.status()
    log.info(`Progress: ${i}/${totalOps}`, {
      memory: status.memoryMB,
      percent: Math.round(status.memoryPercent * 100),
      throttled: status.isThrottled,
      level: status.level,
    })
  }

  promises.push(heavyOperation(i))
}

// Wait for remaining operations
await Promise.all(promises)

log.info("All operations completed, collecting final stats...")
await new Promise((resolve) => setTimeout(resolve, 1000))

const finalStatus = Resource.status()
const elapsedMs = Date.now() - stats.startTime

console.log("\n" + "=".repeat(80))
console.log("📊 STRESS TEST RESULTS")
console.log("=".repeat(80))
console.log(`✅ Total operations:     ${stats.iterations}`)
console.log(`⏱️  Total time:           ${(elapsedMs / 1000).toFixed(2)}s`)
console.log(`🚀 Ops/second:           ${(stats.iterations / (elapsedMs / 1000)).toFixed(2)}`)
console.log(``)
console.log(`📈 Memory Stats:`)
console.log(`   Peak memory:         ${stats.peakMemory} MB`)
console.log(`   Final memory:        ${finalStatus.memoryMB} MB`)
console.log(`   Max allowed:         300 MB`)
console.log(``)
console.log(`📊 Status Distribution:`)
console.log(`   Normal runs:         ${stats.normalCount}`)
console.log(`   Throttled runs:      ${stats.throttledCount}`)
console.log(`   Warning triggers:    ${stats.warningCount}`)
console.log(`   Critical triggers:   ${stats.criticalCount}`)
console.log(``)

if (stats.throttledCount > 0) {
  console.log(`✅ Throttling worked! ${stats.throttledCount} operations were throttled`)
} else {
  console.log(`ℹ️  No throttling needed - memory stayed under control`)
}

if (stats.peakMemory > 300) {
  console.log(`⚠️  Peak memory (${stats.peakMemory}MB) exceeded limit (300MB)`)
  console.log(`   But throttling helped prevent further growth`)
} else {
  console.log(`✅ Memory stayed within limits throughout test`)
}

console.log("=".repeat(80))

Resource.stop()

// Clean up
heavyData.length = 0
if (global.gc) {
  log.info("Running final GC...")
  global.gc()
}

await new Promise((resolve) => setTimeout(resolve, 1000))
