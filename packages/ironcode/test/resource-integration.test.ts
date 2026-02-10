#!/usr/bin/env bun
/**
 * Test IronCode with resource monitor enabled
 * This script will:
 * 1. Start IronCode serve with resource monitor
 * 2. Monitor memory usage
 * 3. Report statistics
 */

import { $ } from "bun"
import { spawn } from "child_process"

console.log("=".repeat(80))
console.log("🧪 Testing IronCode with Resource Monitor")
console.log("=".repeat(80))

// Start IronCode serve with resource monitor enabled
console.log("\n📊 Starting IronCode server with resource monitoring...")
console.log("   Max memory limit: 512 MB (low to trigger warnings)")
console.log("   Check interval: 2 seconds")
console.log("")

const ironcode = spawn(
  "bun",
  [
    "run",
    "--conditions=browser",
    "./src/index.ts",
    "serve",
    "--enable-resource-monitor",
    "--max-memory",
    "512",
    "--print-logs",
    "--log-level",
    "INFO",
  ],
  {
    cwd: "/Users/jamesvu/Documents/Personals/ironcode/packages/ironcode",
    stdio: ["ignore", "pipe", "pipe"],
  },
)

let logs: string[] = []

ironcode.stdout?.on("data", (data) => {
  const text = data.toString()
  process.stdout.write(text)
  logs.push(text)
})

ironcode.stderr?.on("data", (data) => {
  const text = data.toString()
  process.stderr.write(text)
  logs.push(text)
})

// Monitor for 20 seconds
console.log("⏱️  Monitoring for 20 seconds...")
console.log("")

let resourceLogs = 0
let warningLogs = 0
let throttleLogs = 0

setTimeout(() => {
  console.log("\n" + "=".repeat(80))
  console.log("📈 Test Results:")
  console.log("=".repeat(80))

  // Analyze logs
  const allLogs = logs.join("")
  resourceLogs = (allLogs.match(/service=resource/g) || []).length
  warningLogs = (allLogs.match(/Resource usage elevated|WARN.*resource/gi) || []).length
  throttleLogs = (allLogs.match(/throttling|throttled/gi) || []).length

  console.log(`✅ Resource monitor logs detected: ${resourceLogs}`)
  console.log(`⚠️  Warning logs: ${warningLogs}`)
  console.log(`🐌 Throttling logs: ${throttleLogs}`)

  if (resourceLogs > 0) {
    console.log("\n✅ Resource monitor is ACTIVE and working!")
  } else {
    console.log("\n❌ Resource monitor not detected in logs")
  }

  console.log("\n🛑 Stopping IronCode server...")
  ironcode.kill("SIGTERM")

  setTimeout(() => {
    ironcode.kill("SIGKILL")
    process.exit(0)
  }, 2000)
}, 20000)

ironcode.on("exit", (code) => {
  console.log(`\nIronCode server exited with code: ${code}`)
  process.exit(code || 0)
})
