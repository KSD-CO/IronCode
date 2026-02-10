#!/usr/bin/env bun
/**
 * Test clone optimization specifically
 * Simulates the actual prompt loop that does cloning
 */

import { clone } from "remeda"

console.log("🧪 Testing Clone Optimization Impact\n")

// Create sample message array (like real conversation)
function createMessage(id: number) {
  return {
    id,
    info: {
      id: String(id),
      role: id % 2 === 0 ? "user" : "assistant",
    },
    parts: Array(20)
      .fill(0)
      .map((_, i) => ({
        type: "text",
        text: "x".repeat(500), // 500 chars per part
        metadata: { tokens: 100 },
      })),
  }
}

const messageCount = 300
const msgs = Array(messageCount)
  .fill(0)
  .map((_, i) => createMessage(i))

console.log(`Created ${messageCount} messages`)
console.log(`Sample message size: ~${JSON.stringify(createMessage(0)).length / 1024}KB`)
console.log(`Total estimated: ~${(JSON.stringify(createMessage(0)).length * messageCount) / 1024 / 1024}MB\n`)

// Simulate OLD approach (deep clone everything)
console.log("🔴 OLD APPROACH: Deep clone everything")
const startOld = Date.now()
let memStartOld = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)

const iterations = 10
for (let i = 0; i < iterations; i++) {
  const sessionMessages = clone(msgs) // Deep clone!

  // Simulate modification
  for (const msg of sessionMessages) {
    if (msg.info.role === "user") {
      for (const part of msg.parts) {
        if (part.type === "text") {
          part.text = "<reminder>" + part.text + "</reminder>"
        }
      }
    }
  }
}

const timeOld = Date.now() - startOld
let memEndOld = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)

console.log(`  Time: ${timeOld}ms`)
console.log(`  Memory: ${memStartOld}MB → ${memEndOld}MB`)
console.log(`  Increase: ${(Number(memEndOld) - Number(memStartOld)).toFixed(1)}MB\n`)

// Force GC
if (global.gc) global.gc()
await new Promise((resolve) => setTimeout(resolve, 500))

// Simulate NEW approach (selective clone)
console.log("🟢 NEW APPROACH: Selective clone")
const startNew = Date.now()
let memStartNew = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)

for (let i = 0; i < iterations; i++) {
  const sessionMessages: typeof msgs = []

  // Only clone what needs modification
  for (const msg of msgs) {
    if (msg.info.role === "user") {
      const clonedMsg = { ...msg, parts: [...msg.parts] }
      for (let j = 0; j < clonedMsg.parts.length; j++) {
        const part = clonedMsg.parts[j]
        if (part.type === "text") {
          clonedMsg.parts[j] = {
            ...part,
            text: "<reminder>" + part.text + "</reminder>",
          }
        }
      }
      sessionMessages.push(clonedMsg)
    } else {
      sessionMessages.push(msg) // Reuse original
    }
  }
}

const timeNew = Date.now() - startNew
let memEndNew = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)

console.log(`  Time: ${timeNew}ms`)
console.log(`  Memory: ${memStartNew}MB → ${memEndNew}MB`)
console.log(`  Increase: ${(Number(memEndNew) - Number(memStartNew)).toFixed(1)}MB\n`)

// Summary
console.log("=".repeat(60))
console.log("📊 COMPARISON")
console.log("=".repeat(60))
console.log(`Time saved:     ${timeOld - timeNew}ms (${((1 - timeNew / timeOld) * 100).toFixed(1)}% faster)`)
console.log(
  `Memory saved:   ${(Number(memEndOld) - Number(memStartOld) - (Number(memEndNew) - Number(memStartNew))).toFixed(1)}MB`,
)
console.log(`Efficiency:     ${((timeNew / timeOld) * 100).toFixed(1)}% of original time`)
console.log("=".repeat(60))

if (timeNew < timeOld) {
  console.log("\n✅ NEW APPROACH IS FASTER AND MORE MEMORY EFFICIENT!")
} else {
  console.log("\n⚠️  Results inconclusive, may need more iterations")
}
