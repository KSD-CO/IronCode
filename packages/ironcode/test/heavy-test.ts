#!/usr/bin/env bun
/**
 * Heavy stress test - simulate real workload without AI calls
 * Tests: file operations, data processing, concurrent tasks
 */

import { Resource } from "../src/util/resource"
import { Log } from "../src/util/log"
import fs from "fs/promises"
import path from "path"

await Log.init({ print: true, dev: true, level: "INFO" })

const log = Log.create({ service: "heavy-test" })

// Configure with 300MB limit (production default)
Resource.configure({
  maxMemoryMB: 300,
  checkIntervalMs: 2000,
})

Resource.start()

log.info("💪 HEAVY LOAD TEST - Simulating Real Workload")

const stats = {
  filesCreated: 0,
  filesRead: 0,
  dataProcessed: 0,
  throttledOps: 0,
  totalOps: 0,
  startTime: Date.now(),
  peakMemory: 0,
}

// Create temp directory
const testDir = "/tmp/ironcode-heavy-test"
await fs.mkdir(testDir, { recursive: true })

// Simulate heavy data processing (like parsing large files)
function processLargeData(size: number) {
  const data = new Array(size).fill(0).map((_, i) => ({
    id: i,
    name: `item-${i}`,
    data: Math.random().toString(36).repeat(100),
    nested: {
      level1: { level2: { level3: "deep data" } },
    },
  }))

  // Simulate processing
  const processed = data
    .filter((item) => item.id % 2 === 0)
    .map((item) => ({ ...item, processed: true }))
    .reduce(
      (acc, item) => {
        acc[item.id] = item
        return acc
      },
      {} as Record<number, any>,
    )

  stats.dataProcessed += size
  return processed
}

// Simulate file operations
async function heavyFileOperation(id: number) {
  const status = Resource.status()

  if (status.memoryMB > stats.peakMemory) {
    stats.peakMemory = status.memoryMB
  }

  if (status.isThrottled) {
    stats.throttledOps++
    log.warn(`Operation ${id} running under throttle`, {
      memory: status.memoryMB,
      level: status.level,
    })
  }

  stats.totalOps++

  // Create large file
  const filePath = path.join(testDir, `test-${id}.json`)
  const largeData = processLargeData(1000) // Process 1000 items
  await fs.writeFile(filePath, JSON.stringify(largeData))
  stats.filesCreated++

  // Use throttle-aware delay
  await Resource.delay(10)

  // Read it back
  const content = await fs.readFile(filePath, "utf-8")
  const parsed = JSON.parse(content)
  stats.filesRead++

  // Process more data
  processLargeData(500)

  await Resource.delay(10)

  // Clean up
  await fs.unlink(filePath)
}

// Run heavy concurrent operations
log.info("Starting HEAVY concurrent operations...")

const batchSize = 10
const totalBatches = 20 // 200 operations total

for (let batch = 0; batch < totalBatches; batch++) {
  const promises: Promise<void>[] = []

  // Launch batch
  for (let i = 0; i < batchSize; i++) {
    const opId = batch * batchSize + i
    promises.push(heavyFileOperation(opId))
  }

  await Promise.all(promises)

  const status = Resource.status()
  log.info(`Batch ${batch + 1}/${totalBatches} complete`, {
    memory: status.memoryMB,
    percent: Math.round(status.memoryPercent * 100),
    throttled: status.isThrottled,
    level: status.level,
    opsCompleted: stats.totalOps,
  })

  // Force GC between batches if available
  if (global.gc && status.memoryMB > 200) {
    global.gc()
  }
}

log.info("All operations completed!")
await new Promise((resolve) => setTimeout(resolve, 1000))

// Cleanup
await fs.rm(testDir, { recursive: true, force: true })

const finalStatus = Resource.status()
const elapsedSec = (Date.now() - stats.startTime) / 1000

console.log("\n" + "=".repeat(80))
console.log("💪 HEAVY LOAD TEST RESULTS")
console.log("=".repeat(80))
console.log(`✅ Total operations:       ${stats.totalOps}`)
console.log(`📁 Files created:          ${stats.filesCreated}`)
console.log(`📖 Files read:             ${stats.filesRead}`)
console.log(`🔄 Data items processed:   ${stats.dataProcessed.toLocaleString()}`)
console.log(`⏱️  Total time:             ${elapsedSec.toFixed(2)}s`)
console.log(`🚀 Ops/second:             ${(stats.totalOps / elapsedSec).toFixed(2)}`)
console.log(``)
console.log(`📈 Memory Stats:`)
console.log(`   Peak memory:           ${stats.peakMemory} MB`)
console.log(`   Final memory:          ${finalStatus.memoryMB} MB`)
console.log(`   Max allowed:           300 MB`)
console.log(`   Peak usage:            ${Math.round((stats.peakMemory / 300) * 100)}%`)
console.log(``)
console.log(`🐌 Throttling Stats:`)
console.log(`   Operations throttled:  ${stats.throttledOps}`)
console.log(`   Throttle rate:         ${((stats.throttledOps / stats.totalOps) * 100).toFixed(1)}%`)
console.log(``)

if (stats.throttledOps > 0) {
  console.log(`✅ SUCCESS: Throttling activated ${stats.throttledOps} times`)
  console.log(`   System protected from memory overflow!`)
} else {
  console.log(`✅ SUCCESS: Memory stayed under control without throttling`)
}

if (stats.peakMemory > 300) {
  console.log(`⚠️  WARNING: Peak memory exceeded limit`)
  console.log(`   Peak: ${stats.peakMemory}MB, Limit: 300MB`)
} else if (stats.peakMemory > 240) {
  console.log(`⚠️  Memory approached warning threshold (240MB)`)
} else {
  console.log(`✅ Memory stayed well within limits`)
}

console.log("=".repeat(80))

Resource.stop()
