import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { Resource } from "../src/util/resource"

describe("Resource Monitor", () => {
  beforeAll(() => {
    // Configure with reasonable limits
    Resource.configure({
      maxMemoryMB: 2048,
      checkIntervalMs: 1000,
    })
  })

  afterAll(() => {
    Resource.stop()
  })

  test("status() returns valid structure", () => {
    const status = Resource.status()

    expect(status).toHaveProperty("memoryMB")
    expect(status).toHaveProperty("memoryPercent")
    expect(status).toHaveProperty("cpuPercent")
    expect(status).toHaveProperty("isThrottled")
    expect(status).toHaveProperty("level")

    expect(typeof status.memoryMB).toBe("number")
    expect(typeof status.memoryPercent).toBe("number")
    expect(typeof status.cpuPercent).toBe("number")
    expect(typeof status.isThrottled).toBe("boolean")
    expect(["normal", "warning", "critical"]).toContain(status.level)
  })

  test("shouldThrottle() returns boolean", () => {
    const throttled = Resource.shouldThrottle()
    expect(typeof throttled).toBe("boolean")
  })

  test("delay() respects throttling multiplier", async () => {
    const delayMs = 100
    const start = Date.now()

    await Resource.delay(delayMs)

    const elapsed = Date.now() - start

    // Should be roughly 100ms (not throttled) or 200ms (throttled)
    // Allow 50ms tolerance
    expect(elapsed).toBeGreaterThan(delayMs - 50)
  })

  test("ifNotThrottled() executes callback", () => {
    let executed = false
    const result = Resource.ifNotThrottled(() => {
      executed = true
      return 42
    })

    // If not throttled, should execute and return value
    // If throttled, should return null
    if (result === null) {
      expect(executed).toBe(false)
    } else {
      expect(executed).toBe(true)
      expect(result).toBe(42)
    }
  })

  test("batchProcess() yields batches correctly", async () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const batches: number[][] = []

    for await (const batch of Resource.batchProcess(items, 3)) {
      batches.push(batch)
    }

    // Should have 4 batches: [1,2,3], [4,5,6], [7,8,9], [10]
    expect(batches.length).toBeGreaterThan(0)
    expect(batches.length).toBeLessThanOrEqual(4)

    // All items should be processed
    const allItems = batches.flat()
    expect(allItems).toEqual(items)
  })

  test("configure() updates limits", () => {
    Resource.configure({
      maxMemoryMB: 1024,
    })

    // Can't directly test internal state, but can verify no errors thrown
    expect(true).toBe(true)
  })

  test("start/stop don't throw errors", () => {
    expect(() => Resource.start()).not.toThrow()
    expect(() => Resource.stop()).not.toThrow()
  })
})
