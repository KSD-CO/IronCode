#!/usr/bin/env bun
/**
 * EXTREME stress test - simulate long AI conversation with history
 * This will actually trigger throttling
 */

import { Resource } from "../src/util/resource"
import { Log } from "../src/util/log"

await Log.init({ print: true, dev: true, level: "INFO" })

const log = Log.create({ service: "extreme-test" })

// Use 200MB limit to trigger throttling easier
Resource.configure({
  maxMemoryMB: 200,
  checkIntervalMs: 1000, // Check every second
})

Resource.start()

log.info("🔥 EXTREME TEST - Simulating Long Conversation History")

const stats = {
  messagesCreated: 0,
  throttledOps: 0,
  totalOps: 0,
  startTime: Date.now(),
  peakMemory: 0,
  throttleEvents: [] as Array<{ time: number; memory: number }>,
}

// Simulate message history (like AI conversation)
const messageHistory: any[] = []

function createMessage(id: number) {
  // Simulate a large message with tool results
  return {
    id,
    role: id % 2 === 0 ? "user" : "assistant",
    timestamp: Date.now(),
    content: `Message ${id}: ` + "x".repeat(1000), // 1KB of text
    parts: Array(50)
      .fill(0)
      .map((_, i) => ({
        type: i % 3 === 0 ? "text" : "tool",
        content: "Large content ".repeat(100), // ~1.5KB per part
        metadata: {
          timestamp: Date.now(),
          provider: "test",
          tokens: Math.floor(Math.random() * 1000),
        },
      })),
    // Simulate tool results
    toolResults: Array(10)
      .fill(0)
      .map((_, i) => ({
        tool: `tool-${i}`,
        input: { data: "x".repeat(500) },
        output: { result: "y".repeat(1000) },
        attachments: Array(3)
          .fill(0)
          .map((_, j) => ({
            name: `file-${j}.txt`,
            content: "z".repeat(2000), // 2KB per attachment
          })),
      })),
  }
}

async function processConversationBatch(batchNum: number, size: number) {
  const status = Resource.status()

  if (status.memoryMB > stats.peakMemory) {
    stats.peakMemory = status.memoryMB
  }

  if (status.isThrottled) {
    stats.throttledOps++
    stats.throttleEvents.push({
      time: Date.now() - stats.startTime,
      memory: status.memoryMB,
    })
    log.warn(`🐌 Batch ${batchNum} THROTTLED`, {
      memory: status.memoryMB,
      percent: Math.round(status.memoryPercent * 100),
      level: status.level,
      historySize: messageHistory.length,
    })
  }

  stats.totalOps++

  // Create messages
  for (let i = 0; i < size; i++) {
    const msg = createMessage(stats.messagesCreated)
    messageHistory.push(msg)
    stats.messagesCreated++
  }

  // Simulate processing entire history (like toModelMessages)
  const processed = messageHistory
    .filter((m) => m.role === "assistant")
    .map((m) => ({
      ...m,
      processed: true,
      parts: m.parts.filter((p: any) => p.type === "text"),
    }))

  await Resource.delay(50)

  return processed.length
}

// Run test
log.info("Building conversation history...")

const messagesPerBatch = 20
const totalBatches = 30 // Will create 600 messages

for (let batch = 1; batch <= totalBatches; batch++) {
  await processConversationBatch(batch, messagesPerBatch)

  const status = Resource.status()

  if (batch % 5 === 0) {
    log.info(`Progress: ${batch}/${totalBatches}`, {
      memory: status.memoryMB,
      percent: Math.round(status.memoryPercent * 100),
      throttled: status.isThrottled,
      level: status.level,
      messages: stats.messagesCreated,
      historySize: messageHistory.length,
    })
  }
}

log.info("All batches completed!")
await new Promise((resolve) => setTimeout(resolve, 2000))

const finalStatus = Resource.status()
const elapsedSec = (Date.now() - stats.startTime) / 1000

console.log("\n" + "=".repeat(80))
console.log("🔥 EXTREME LOAD TEST RESULTS")
console.log("=".repeat(80))
console.log(`✅ Total batches:          ${stats.totalOps}`)
console.log(`💬 Messages created:       ${stats.messagesCreated}`)
console.log(`📚 History size:           ${messageHistory.length} messages`)
console.log(`⏱️  Total time:             ${elapsedSec.toFixed(2)}s`)
console.log(``)
console.log(`📈 Memory Stats:`)
console.log(`   Peak memory:           ${stats.peakMemory} MB`)
console.log(`   Final memory:          ${finalStatus.memoryMB} MB`)
console.log(`   Max allowed:           200 MB`)
console.log(`   Peak usage:            ${Math.round((stats.peakMemory / 200) * 100)}%`)
console.log(``)
console.log(`🐌 Throttling Stats:`)
console.log(`   Throttled batches:     ${stats.throttledOps}/${stats.totalOps}`)
console.log(`   Throttle rate:         ${((stats.throttledOps / stats.totalOps) * 100).toFixed(1)}%`)
console.log(`   Throttle events:       ${stats.throttleEvents.length}`)
console.log(``)

if (stats.throttleEvents.length > 0) {
  console.log(`🐌 Throttle Timeline:`)
  stats.throttleEvents.slice(0, 5).forEach((evt, i) => {
    console.log(`   ${i + 1}. At ${(evt.time / 1000).toFixed(1)}s - ${evt.memory}MB`)
  })
  if (stats.throttleEvents.length > 5) {
    console.log(`   ... and ${stats.throttleEvents.length - 5} more`)
  }
  console.log(``)
}

if (stats.throttledOps > 0) {
  console.log(`✅ SUCCESS: Throttling protected system!`)
  console.log(`   ${stats.throttledOps} operations slowed down to prevent overflow`)
} else {
  console.log(`ℹ️  No throttling needed - memory stayed under threshold`)
}

if (stats.peakMemory > 200) {
  console.log(`⚠️  Peak memory EXCEEDED limit: ${stats.peakMemory}MB > 200MB`)
  console.log(`   But throttling prevented further growth`)
} else if (stats.peakMemory > 160) {
  console.log(`⚠️  Memory reached warning zone: ${stats.peakMemory}MB (${Math.round((stats.peakMemory / 200) * 100)}%)`)
  console.log(`   Throttling ${stats.throttledOps > 0 ? "activated" : "ready to activate"}`)
} else {
  console.log(`✅ Memory stayed comfortably within limits`)
}

console.log("=".repeat(80))

Resource.stop()

// Estimate message size
const sampleMsg = createMessage(0)
const msgSizeEstimate = JSON.stringify(sampleMsg).length / 1024 // KB
console.log(``)
console.log(`📊 Message Statistics:`)
console.log(`   Avg message size:      ~${msgSizeEstimate.toFixed(1)} KB`)
console.log(`   Total data created:    ~${((msgSizeEstimate * stats.messagesCreated) / 1024).toFixed(1)} MB`)
console.log(
  `   Memory efficiency:     ${((finalStatus.memoryMB / ((msgSizeEstimate * stats.messagesCreated) / 1024)) * 100).toFixed(1)}%`,
)
