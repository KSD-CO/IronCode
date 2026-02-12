/**
 * Semaphore for controlling concurrent operations
 * Useful for preventing OOM when spawning many processes
 */
export class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<() => void> {
    if (this.permits > 0) {
      this.permits--
      return () => this.release()
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release())
      })
    })
  }

  private release() {
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.permits++
    }
  }

  /**
   * Execute a function with semaphore protection
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  /**
   * Get current available permits
   */
  get available(): number {
    return this.permits
  }

  /**
   * Get queue length
   */
  get waiting(): number {
    return this.queue.length
  }
}
