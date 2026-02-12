import { Log } from "./log"

/**
 * Resource monitor that tracks memory and CPU usage
 * Provides throttling mechanisms when limits are approached
 */
export namespace Resource {
  const log = Log.create({ service: "resource" })

  export interface Limits {
    /** Max memory in MB (default: 1024 for macOS/Linux, 2048 for Windows) */
    maxMemoryMB: number
    /** Memory warning threshold (default: 0.8 = 80%) */
    memoryWarningThreshold: number
    /** Memory critical threshold (default: 0.95 = 95%) */
    memoryCriticalThreshold: number
    /** CPU warning threshold in % (default: 80) */
    cpuWarningThreshold: number
    /** Check interval in ms (default: 5000) */
    checkIntervalMs: number
  }

  const defaultLimits: Limits = {
    maxMemoryMB: process.platform === "win32" ? 2048 : 1024,
    memoryWarningThreshold: 0.8,
    memoryCriticalThreshold: 0.95,
    cpuWarningThreshold: 80,
    checkIntervalMs: 5000,
  }

  let limits: Limits = { ...defaultLimits }
  let intervalHandle: Timer | null = null
  let isThrottled = false
  let lastCpuUsage = process.cpuUsage()
  let lastCheckTime = Date.now()

  export interface Status {
    memoryMB: number
    memoryPercent: number
    cpuPercent: number
    isThrottled: boolean
    level: "normal" | "warning" | "critical"
  }

  /**
   * Get current resource usage
   */
  export function status(): Status {
    const memUsage = process.memoryUsage()
    const memoryMB = Math.round(memUsage.heapUsed / 1024 / 1024)
    const memoryPercent = memoryMB / limits.maxMemoryMB

    // Calculate CPU usage since last check
    const currentCpuUsage = process.cpuUsage(lastCpuUsage)
    const currentTime = Date.now()
    const elapsedMs = currentTime - lastCheckTime
    const elapsedUs = elapsedMs * 1000

    // CPU percent = (user + system time) / elapsed time * 100
    const cpuPercent = ((currentCpuUsage.user + currentCpuUsage.system) / elapsedUs) * 100

    lastCpuUsage = process.cpuUsage()
    lastCheckTime = currentTime

    let level: Status["level"] = "normal"
    if (memoryPercent >= limits.memoryCriticalThreshold) {
      level = "critical"
    } else if (memoryPercent >= limits.memoryWarningThreshold || cpuPercent >= limits.cpuWarningThreshold) {
      level = "warning"
    }

    return {
      memoryMB,
      memoryPercent,
      cpuPercent: Math.round(cpuPercent),
      isThrottled,
      level,
    }
  }

  /**
   * Configure resource limits
   */
  export function configure(config: Partial<Limits>) {
    limits = { ...limits, ...config }
    log.info("Resource limits configured", { limits })
  }

  /**
   * Start monitoring resources
   */
  export function start() {
    if (intervalHandle) {
      log.warn("Resource monitor already started")
      return
    }

    log.info("Starting resource monitor", { limits })
    lastCpuUsage = process.cpuUsage()
    lastCheckTime = Date.now()

    intervalHandle = setInterval(() => {
      const current = status()

      if (current.level === "critical") {
        if (!isThrottled) {
          isThrottled = true
          log.error("CRITICAL: Memory usage exceeded threshold, enabling throttling", {
            memoryMB: current.memoryMB,
            maxMemoryMB: limits.maxMemoryMB,
            percent: Math.round(current.memoryPercent * 100),
          })

          // Trigger garbage collection if available
          if (global.gc) {
            log.info("Forcing garbage collection")
            global.gc()
          }
        }
      } else if (current.level === "warning") {
        if (isThrottled) {
          isThrottled = false
          log.info("Memory usage back to normal, disabling throttling", {
            memoryMB: current.memoryMB,
            percent: Math.round(current.memoryPercent * 100),
          })
        } else {
          log.warn("Resource usage elevated", {
            memoryMB: current.memoryMB,
            memoryPercent: Math.round(current.memoryPercent * 100),
            cpuPercent: current.cpuPercent,
          })
        }
      } else {
        if (isThrottled) {
          isThrottled = false
          log.info("Resource usage normalized", {
            memoryMB: current.memoryMB,
            percent: Math.round(current.memoryPercent * 100),
          })
        }
      }
    }, limits.checkIntervalMs)
  }

  /**
   * Stop monitoring
   */
  export function stop() {
    if (intervalHandle) {
      clearInterval(intervalHandle)
      intervalHandle = null
      log.info("Resource monitor stopped")
    }
  }

  /**
   * Check if currently throttled
   */
  export function shouldThrottle(): boolean {
    return isThrottled
  }

  /**
   * Async delay that respects throttling
   * When throttled, delays are longer to reduce workload
   */
  export async function delay(ms: number): Promise<void> {
    const actualDelay = isThrottled ? ms * 2 : ms
    return new Promise((resolve) => setTimeout(resolve, actualDelay))
  }

  /**
   * Run callback only if not throttled
   * Returns true if executed, false if skipped
   */
  export function ifNotThrottled<T>(callback: () => T): T | null {
    if (isThrottled) {
      return null
    }
    return callback()
  }

  /**
   * Batch process items with automatic throttling
   * Processes fewer items when under memory pressure
   */
  export async function* batchProcess<T>(items: T[], batchSize: number = 10): AsyncGenerator<T[], void, unknown> {
    let currentBatch: T[] = []
    const actualBatchSize = isThrottled ? Math.max(1, Math.floor(batchSize / 2)) : batchSize

    for (let i = 0; i < items.length; i++) {
      currentBatch.push(items[i])

      if (currentBatch.length >= actualBatchSize || i === items.length - 1) {
        yield currentBatch
        currentBatch = []

        // Add delay between batches when throttled
        if (isThrottled) {
          await delay(100)
        }
      }
    }
  }
}
