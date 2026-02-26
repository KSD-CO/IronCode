import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { FileIgnore } from "./ignore"
import { Config } from "../config/config"
import {
  watcherCreateFFI,
  watcherPollEventsFFI,
  watcherPendingCountFFI,
  watcherRemoveFFI,
  watcherListFFI,
  watcherGetInfoFFI,
  type WatcherEvent,
  type WatcherInfo,
} from "../tool/ffi"

export namespace WatcherNative {
  const log = Log.create({ service: "file.watcher.native" })

  export const Event = {
    Updated: BusEvent.define(
      "file.watcher.updated",
      z.object({
        file: z.string(),
        event: z.union([z.literal("add"), z.literal("change"), z.literal("unlink")]),
      }),
    ),
  }

  interface ActiveWatcher {
    id: string
    path: string
    pollInterval?: Timer
  }

  const state = Instance.state(
    async () => {
      log.info("init native watcher")
      const cfg = await Config.get()
      const cfgIgnores = cfg.watcher?.ignore ?? []
      const ignorePatterns = [...FileIgnore.PATTERNS, ...cfgIgnores]

      const watchers: ActiveWatcher[] = []

      // Watch instance directory
      const instanceId = "instance-watch"
      try {
        watcherCreateFFI(instanceId, Instance.directory, ignorePatterns, 1000)
        const watcher: ActiveWatcher = {
          id: instanceId,
          path: Instance.directory,
        }
        // Start polling for events
        watcher.pollInterval = setInterval(() => {
          try {
            const events = watcherPollEventsFFI(instanceId)
            for (const evt of events) {
              Bus.publish(Event.Updated, { file: evt.path, event: evt.event_type })
            }
          } catch (error) {
            log.error("poll error", { id: instanceId, error })
          }
        }, 50) // Poll every 50ms
        watchers.push(watcher)
        log.info("watching instance directory", { path: Instance.directory })
      } catch (error) {
        log.error("failed to create instance watcher", { error })
      }

      return { watchers }
    },
    async (state) => {
      if (!state.watchers) return
      for (const watcher of state.watchers) {
        if (watcher.pollInterval) {
          clearInterval(watcher.pollInterval)
        }
        try {
          watcherRemoveFFI(watcher.id)
        } catch {}
      }
    },
  )

  export function init() {
    state()
  }

  export function list(): WatcherInfo[] {
    try {
      const ids = watcherListFFI()
      return ids.map((id) => watcherGetInfoFFI(id))
    } catch {
      return []
    }
  }

  export function getInfo(id: string): WatcherInfo | undefined {
    try {
      return watcherGetInfoFFI(id)
    } catch {
      return undefined
    }
  }
}
