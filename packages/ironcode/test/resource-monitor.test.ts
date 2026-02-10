#!/usr/bin/env bun
/**
 * Test script for resource monitor
 * This simulates high memory usage to trigger throttling
 */

import { Resource } from "../src/util/resource"
import { Log } from "../src/util/log"

await Log.init({ print: true, dev: true, level: "INFO" })

const log = Log.create({ service: "resource-test" })

// Configure with low limit for testing
Resource.configure({
  maxMemoryMB: 200, // Low limit to trigger easily
  checkIntervalMs: 2000, // Check every 2s
})

Resource.start()

log.info("Resource monitor test started")
log.info("Will allocate memory in chunks to trigger throttling")

// Allocate memory gradually
const arrays: number[][] = []
for (let i = 0; i < 50; i++) {
  const status = Resource.status()
  log.info("Iteration " + i, {
    memoryMB: status.memoryMB,
    percent: Math.round(status.memoryPercent * 100),
    throttled: status.isThrottled,
    level: status.level,
  })

  // Allocate ~10MB
  arrays.push(new Array(1024 * 1024 * 2.5).fill(Math.random()))

  // Use throttle-aware delay
  await Resource.delay(500)

  if (status.isThrottled) {
    log.warn("Throttling detected! Delays should be 2x slower now")
  }
}

log.info("Test complete, cleaning up")
Resource.stop()

// Allow some time for final logs
await new Promise((resolve) => setTimeout(resolve, 1000))
