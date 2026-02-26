import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { Log } from "@/util/log"
import { Instance } from "./instance"
import { FileWatcher } from "@/file/watcher"
import { getVcsInfoFFI } from "@/tool/ffi"

const log = Log.create({ service: "vcs" })

export namespace Vcs {
  export const Event = {
    BranchUpdated: BusEvent.define(
      "vcs.branch.updated",
      z.object({
        branch: z.string().optional(),
      }),
    ),
  }

  export const Info = z
    .object({
      branch: z.string(),
      added: z.number().optional(),
      modified: z.number().optional(),
      deleted: z.number().optional(),
    })
    .meta({
      ref: "VcsInfo",
    })
  export type Info = z.infer<typeof Info>

  function currentBranch() {
    const info = getVcsInfoFFI(Instance.worktree)
    return info?.branch
  }

  const state = Instance.state(
    async () => {
      if (Instance.project.vcs !== "git") {
        return {
          branch: () => undefined,
          unsubscribe: undefined,
        }
      }
      let current = currentBranch()
      log.info("initialized", { branch: current })

      const unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, (evt) => {
        if (evt.properties.file.endsWith("HEAD")) return
        const next = currentBranch()
        if (next !== current) {
          log.info("branch changed", { from: current, to: next })
          current = next
          Bus.publish(Event.BranchUpdated, { branch: next })
        }
      })

      return {
        branch: () => current,
        unsubscribe,
      }
    },
    async (state) => {
      state.unsubscribe?.()
    },
  )

  export async function init() {
    return state()
  }

  export async function branch() {
    const s = await state()
    return s.branch()
  }

  export async function info(): Promise<Info | undefined> {
    const s = await state()
    const branch = s.branch()
    if (!branch) return undefined

    // Use native Rust implementation for better performance
    const result = getVcsInfoFFI(Instance.worktree)
    if (!result) return undefined

    return {
      branch: result.branch,
      added: result.added,
      modified: result.modified,
      deleted: result.deleted,
    }
  }
}
