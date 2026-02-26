import {
  lockAcquireReadFFI,
  lockAcquireWriteFFI,
  lockCheckReadFFI,
  lockCheckWriteFFI,
  lockFinalizeReadFFI,
  lockFinalizeWriteFFI,
  lockReleaseReadFFI,
  lockReleaseWriteFFI,
  lockGetStatsFFI,
} from "../tool/ffi"

export namespace LockNative {
  export async function read(key: string): Promise<Disposable> {
    const { ticket, acquired } = lockAcquireReadFFI(key)

    // If not immediately acquired, poll until ready
    if (!acquired) {
      while (!lockCheckReadFFI(key, ticket)) {
        // Yield to event loop
        await new Promise((resolve) => setImmediate(resolve))
      }
      // Finalize the acquisition
      lockFinalizeReadFFI(key, ticket)
    }

    return {
      [Symbol.dispose]: () => {
        lockReleaseReadFFI(key)
      },
    }
  }

  export async function write(key: string): Promise<Disposable> {
    const { ticket, acquired } = lockAcquireWriteFFI(key)

    // If not immediately acquired, poll until ready
    if (!acquired) {
      while (!lockCheckWriteFFI(key, ticket)) {
        // Yield to event loop
        await new Promise((resolve) => setImmediate(resolve))
      }
      // Finalize the acquisition
      lockFinalizeWriteFFI(key, ticket)
    }

    return {
      [Symbol.dispose]: () => {
        lockReleaseWriteFFI(key)
      },
    }
  }

  export function stats() {
    return lockGetStatsFFI()
  }
}
